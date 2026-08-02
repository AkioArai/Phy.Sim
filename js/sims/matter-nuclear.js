'use strict';
Object.assign(SIMS,{
/* ================== ГЛ.28: ТИПЫ СВЯЗЕЙ В ТВЁРДЫХ ТЕЛАХ ================= */
crystal:{
  title:'Типы связей в твёрдых телах',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'kind',label:'Тип связи',type:'select',default:'ionic',
     options:[{v:'ionic',t:'Ионная (NaCl)'},
              {v:'covalent',t:'Ковалентная (алмаз)'},
              {v:'metal',t:'Металлическая (медь)'},
              {v:'molecular',t:'Молекулярная (лёд, аргон)'}]},

    {type:'group',label:'Показывать'},
    {key:'ebonds',label:'Электроны и связи',type:'check',default:true},
    {key:'props', label:'Свойства вещества',type:'check',default:true}
  ],
  /* справочные данные: энергия связи (эВ на атом) и температура плавления */
  data:{
    ionic:    {name:'ионная',    ex:'NaCl (поваренная соль)', E:3.28, Tm:801,  cond:'не проводит (в расплаве — проводит)', hard:'твёрдый, но хрупкий'},
    covalent: {name:'ковалентная',ex:'алмаз, кремний',        E:7.37, Tm:3550, cond:'не проводит (или полупроводник)',      hard:'очень твёрдый'},
    metal:    {name:'металлическая',ex:'медь, железо',        E:3.49, Tm:1085, cond:'отлично проводит',                     hard:'пластичный, куётся'},
    molecular:{name:'молекулярная',ex:'лёд, твёрдый аргон',   E:0.08, Tm:-189, cond:'не проводит',                          hard:'мягкий, легкоплавкий'}
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const d=this.data[p.kind];
    return [['тип связи',0,d.name],
      ['пример',0,d.ex],
      ['энергия связи',d.E,'эВ на атом'],
      ['температура плавления',d.Tm,'°C'],
      ['электропроводность',0,d.cond],
      ['механические свойства',0,d.hard],
      ['что удерживает',0,{ionic:'притяжение разноимённых ионов',
        covalent:'общие электронные пары',
        metal:'общий электронный газ',
        molecular:'слабое притяжение нейтральных молекул'}[p.kind]]];
  },
  graphs:[],
  presets:[
    {name:'Ионная: соль',values:{kind:'ionic'}},
    {name:'Ковалентная: алмаз',values:{kind:'covalent'}},
    {name:'Металлическая: медь',values:{kind:'metal'}},
    {name:'Молекулярная: лёд',values:{kind:'molecular'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const d=this.data[p.kind], CX=-1.8, step=1.05;
    // решётка 4×4
    for(let i=0;i<4;i++) for(let j=0;j<4;j++){
      const x=CX-1.6+i*step, y=1.6-j*step;
      if(p.kind==='ionic'){
        const plus=(i+j)%2===0;
        ctx.fillStyle=plus?dang:acc;
        ctx.beginPath(); ctx.arc(x,y,plus?0.24:0.32,0,7); ctx.fill();
        v.label(ctx,plus?'+':'−',x,y,-3,4,'#fff');
      } else if(p.kind==='metal'){
        ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(x,y,0.24,0,7); ctx.fill();
        v.label(ctx,'+',x,y,-3,4,'#fff');
      } else if(p.kind==='molecular'){
        // молекулы — пары атомов
        ctx.fillStyle=sec;
        ctx.beginPath(); ctx.arc(x-0.12,y,0.16,0,7); ctx.fill();
        ctx.beginPath(); ctx.arc(x+0.12,y,0.16,0,7); ctx.fill();
      } else {
        ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(x,y,0.22,0,7); ctx.fill();
      }
    }
    // связи и электроны
    if(p.ebonds){
      if(p.kind==='covalent'){
        ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2);
        for(let i=0;i<4;i++) for(let j=0;j<4;j++){
          const x=CX-1.6+i*step, y=1.6-j*step;
          if(i<3){ ctx.beginPath(); ctx.moveTo(x+0.22,y); ctx.lineTo(x+step-0.22,y); ctx.stroke(); }
          if(j<3){ ctx.beginPath(); ctx.moveTo(x,y-0.22); ctx.lineTo(x,y-step+0.22); ctx.stroke(); }
        }
        // общие пары
        ctx.fillStyle=meas;
        for(let i=0;i<3;i++) for(let j=0;j<4;j++){
          const x=CX-1.6+i*step+step/2, y=1.6-j*step;
          ctx.beginPath(); ctx.arc(x,y-0.07,v.lw(2.2),0,7); ctx.fill();
          ctx.beginPath(); ctx.arc(x,y+0.07,v.lw(2.2),0,7); ctx.fill();
        }
        v.label(ctx,'общие электронные пары держат атомы намертво',CX,-2.3,-116,0,acc);
      } else if(p.kind==='metal'){
        // электронный газ: свободно блуждающие электроны
        ctx.fillStyle=meas;
        for(let k=0;k<26;k++){
          const a=k*2.399+s.ph*0.7;
          const x=CX-1.6+((k*1.37)%3.3), y=1.6-((k*0.91+s.ph*0.35)%3.3);
          ctx.beginPath(); ctx.arc(x+0.18*Math.cos(a),y+0.18*Math.sin(a),v.lw(2.4),0,7); ctx.fill();
        }
        v.label(ctx,'электроны общие для всего кристалла — «электронный газ»',CX,-2.3,-124,0,meas);
      } else if(p.kind==='ionic'){
        ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.2);
        for(let i=0;i<3;i++) for(let j=0;j<4;j++){
          const x=CX-1.6+i*step, y=1.6-j*step;
          ctx.beginPath(); ctx.moveTo(x+0.3,y); ctx.lineTo(x+step-0.3,y); ctx.stroke();
        }
        ctx.globalAlpha=1;
        v.label(ctx,'электрон целиком перешёл к соседу — притягиваются ионы',CX,-2.3,-124,0,dang);
      } else {
        ctx.strokeStyle=ink3; ctx.globalAlpha=.3; ctx.setLineDash([v.lw(2),v.lw(3)]); ctx.lineWidth=v.lw(1);
        for(let i=0;i<3;i++) for(let j=0;j<4;j++){
          const x=CX-1.6+i*step, y=1.6-j*step;
          ctx.beginPath(); ctx.moveTo(x+0.3,y); ctx.lineTo(x+step-0.3,y); ctx.stroke();
        }
        ctx.setLineDash([]); ctx.globalAlpha=1;
        v.label(ctx,'молекулы целые, притяжение между ними очень слабое',CX,-2.3,-118,0,sec);
      }
    }
    // свойства
    if(p.props){
      const gx=2.4;
      const rows=[['пример',d.ex],['энергия связи',`${d.E} эВ`],
        ['плавление',`${d.Tm} °C`],['проводимость',d.cond],['механика',d.hard]];
      v.label(ctx,d.name.toUpperCase()+' СВЯЗЬ',gx,2.4,0,0,acc);
      rows.forEach((r,i)=>{
        v.label(ctx,r[0]+':',gx,2.4,0,26+i*30,ink3);
        v.label(ctx,r[1],gx,2.4,0,40+i*30,ink);
      });
      // шкала прочности
      const bx=gx, by=-2.2, bw=2.6;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+bw,by); ctx.stroke();
      const X=E=>bx+bw*clamp(E/8,0,1);
      for(const k of Object.keys(this.data)){
        const dd=this.data[k], on=(k===p.kind);
        ctx.fillStyle=on?acc:ink3; ctx.globalAlpha=on?1:.4;
        ctx.beginPath(); ctx.arc(X(dd.E),by,v.lw(on?4:2.6),0,7); ctx.fill(); ctx.globalAlpha=1;
      }
      v.label(ctx,'энергия связи, эВ: от 0,08 (лёд) до 7,4 (алмаз)',bx,by,0,20,ink3);
    }
  }
},

/* ================= ГЛ.28: СВОБОДНЫЕ ЭЛЕКТРОНЫ И УРОВЕНЬ ФЕРМИ ================= */
fermi:{
  title:'Свободные электроны в металле: уровень Ферми',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'metal',label:'Металл',type:'select',default:'cu',
     options:[{v:'na',t:'Натрий'},{v:'cu',t:'Медь'},{v:'ag',t:'Серебро'},{v:'al',t:'Алюминий'}]},
    {key:'T',label:'Температура T',unit:'К',min:1,max:3000,step:10,default:300},

    {type:'group',label:'Показывать'},
    {key:'dist',label:'Распределение Ферми',type:'check',default:true},
    {key:'zero',label:'Сравнение с T = 0',type:'check',default:true}
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
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['металл',0,this.ruName[p.metal]],
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
    {name:'Медь у абсолютного нуля',values:{metal:'cu',T:1}},
    {name:'Медь раскалённая',values:{metal:'cu',T:2000}},
    {name:'Натрий: низкая плотность электронов',values:{metal:'na',T:300}},
    {name:'Алюминий: три электрона с атома',values:{metal:'al',T:300}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const EF=this.EF(p), EMAX=EF*1.6;
    const gx=-4.6, gy=-2.4, gw=5.4, gh=5.0;
    const X=f=>gx+gw*f, Y=E=>gy+gh*clamp(E/EMAX,0,1);
    // оси
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    ctx.globalAlpha=1;
    v.label(ctx,'энергия E, эВ',gx,gy+gh,4,-8,ink3);
    v.label(ctx,'заселённость f(E)',gx+gw,gy,-72,16,ink3);
    v.label(ctx,'0',gx,gy,-8,14,ink3); v.label(ctx,'1',gx+gw,gy,-4,14,ink3);
    // уровень Ферми
    ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(gx,Y(EF)); ctx.lineTo(gx+gw,Y(EF)); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`E_F = ${EF.toFixed(2)} эВ`,gx+gw,Y(EF),4,-6,dang);
    // ступенька при T=0
    if(p.zero){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(3),v.lw(3)]);
      ctx.beginPath();
      ctx.moveTo(X(1),gy); ctx.lineTo(X(1),Y(EF)); ctx.lineTo(X(0),Y(EF)); ctx.lineTo(X(0),gy+gh);
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'при T = 0: резкая ступенька',X(0.5),gy+gh,-52,-6,ink3);
    }
    // распределение Ферми при данной T
    if(p.dist){
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=300;i++){ const E=EMAX*i/300;
        const x=X(this.f(p,E)), y=Y(E);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      // размытие ~kT
      const kT=this.kT(p);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(X(0.92),Y(EF-2*kT)); ctx.lineTo(X(0.92),Y(EF+2*kT)); ctx.stroke();
      v.label(ctx,`размытие ~kT = ${kT.toFixed(4)} эВ`,X(0.92),Y(EF+2*kT),6,-6,meas);
    }
    // «море» заполненных состояний
    ctx.fillStyle=acc; ctx.globalAlpha=.12;
    ctx.beginPath(); ctx.moveTo(gx,gy);
    for(let i=0;i<=200;i++){ const E=EMAX*i/200; ctx.lineTo(X(this.f(p,E)),Y(E)); }
    ctx.lineTo(gx,gy+gh); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;

    // ящик с электронами справа
    const bx=1.6, by=-2.4, bw=3.0, bh=5.0;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2);
    ctx.strokeRect(bx,by,bw,bh);
    v.label(ctx,`${this.ruName[p.metal]}: электронный газ`,bx,by+bh,0,-12,ink);
    // уровни, заполненные до E_F
    const NL=22;
    for(let i=0;i<NL;i++){
      const E=EMAX*(i+0.5)/NL, y=by+bh*(E/EMAX);
      const occ=this.f(p,E);
      ctx.strokeStyle=ink3; ctx.globalAlpha=.35; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(bx+0.15,y); ctx.lineTo(bx+bw-0.15,y); ctx.stroke(); ctx.globalAlpha=1;
      // электроны на уровне
      const cnt=Math.round(occ*6);
      ctx.fillStyle=(E<EF)?acc:meas;
      for(let k=0;k<cnt;k++){
        ctx.globalAlpha=clamp(occ,0.15,1);
        ctx.beginPath(); ctx.arc(bx+0.4+k*0.4,y,v.lw(2.6),0,7); ctx.fill();
        ctx.globalAlpha=1;
      }
    }
    ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.6);
    ctx.beginPath(); ctx.moveTo(bx,by+bh*(EF/EMAX)); ctx.lineTo(bx+bw,by+bh*(EF/EMAX)); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,'уровень Ферми',bx+bw,by+bh*(EF/EMAX),4,-6,dang);
    v.label(ctx,'ниже — всё занято (Паули), выше — почти пусто',bx,by,0,-10,ink3);
    v.label(ctx,`ток создают лишь электроны у самой верхушки: их доля ~kT/E_F = ${(this.kT(p)/EF*100).toFixed(2)} %`,
      -4.6,-3.2,0,0,acc);
  }
},

/* ================= ГЛ.28: ЗОННАЯ ТЕОРИЯ И ПОЛУПРОВОДНИКИ ================= */
bands:{
  title:'Зонная теория: металл, полупроводник, диэлектрик',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'mat',label:'Материал',type:'select',default:'si',
     options:[{v:'metal',t:'Металл (медь)'},{v:'ge',t:'Германий, Eg = 0,67 эВ'},
              {v:'si',t:'Кремний, Eg = 1,12 эВ'},{v:'gaas',t:'Арсенид галлия, Eg = 1,42 эВ'},
              {v:'diamond',t:'Алмаз, Eg = 5,5 эВ'}]},
    {key:'dope',label:'Примесь',type:'select',default:'none',
     options:[{v:'none',t:'Чистый (собственный)'},{v:'n',t:'n-тип (донорная)'},{v:'p',t:'p-тип (акцепторная)'}]},
    {key:'T',label:'Температура T',unit:'К',min:50,max:800,step:10,default:300},

    {type:'group',label:'Показывать'},
    {key:'carriers',label:'Носители заряда',type:'check',default:true},
    {key:'curve',   label:'Зависимость проводимости от T',type:'check',default:true}
  ],
  kB:1.380649e-23, e:1.602176634e-19,
  gap:{metal:0, ge:0.67, si:1.12, gaas:1.42, diamond:5.5},
  ruName:{metal:'медь',ge:'германий',si:'кремний',gaas:'арсенид галлия',diamond:'алмаз'},
  Eg(p){ return this.gap[p.mat]; },
  kT(p){ return this.kB*p.T/this.e; },
  /* собственная концентрация носителей ∝ exp(−Eg/2kT) */
  ni(p){
    if(p.mat==='metal') return 1;
    return Math.exp(-this.Eg(p)/(2*this.kT(p)));
  },
  /* качественная проводимость: у металла падает с T, у полупроводника растёт */
  sigma(p){
    if(p.mat==='metal') return 300/p.T;
    let base=this.ni(p);
    if(p.dope!=='none') base+=1e-6;                 // примесные носители есть и при низкой T
    return base;
  },
  kind(p){
    if(p.mat==='metal') return 'проводник: зоны перекрываются, электроны свободны';
    if(this.Eg(p)>3) return 'диэлектрик: щель слишком широка, носителей нет';
    return 'полупроводник: щель узкая, тепло забрасывает электроны наверх';
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const out=[['материал',0,this.ruName[p.mat]],
      ['ширина запрещённой зоны Eg',this.Eg(p),'эВ'],
      ['температура T',p.T,'К'],
      ['тепловая энергия kT',this.kT(p),'эВ'],
      ['отношение Eg/kT',p.mat==='metal'?0:this.Eg(p)/this.kT(p),''],
      ['тип',0,this.kind(p)]];
    if(p.mat!=='metal'){
      out.push(['относительная концентрация носителей',this.ni(p),'~exp(−Eg/2kT)'],
        ['примесь',0,{none:'нет',n:'донорная: лишние электроны',p:'акцепторная: дырки'}[p.dope]],
        ['основные носители',0,p.dope==='n'?'электроны':(p.dope==='p'?'дырки':'поровну электронов и дырок')],
        ['проводимость при нагреве',0,'РАСТЁТ']);
    } else {
      out.push(['проводимость при нагреве',0,'ПАДАЕТ: мешают колебания решётки']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Кремний при комнатной температуре',values:{mat:'si',dope:'none',T:300}},
    {name:'Кремний нагретый — носителей больше',values:{mat:'si',dope:'none',T:600}},
    {name:'Кремний n-типа',values:{mat:'si',dope:'n',T:300}},
    {name:'Кремний p-типа',values:{mat:'si',dope:'p',T:300}},
    {name:'Германий: щель уже',values:{mat:'ge',dope:'none',T:300}},
    {name:'Алмаз: диэлектрик',values:{mat:'diamond',dope:'none',T:300}},
    {name:'Металл: зоны перекрыты',values:{mat:'metal',dope:'none',T:300}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const Eg=this.Eg(p), metal=(p.mat==='metal');
    const bx=-4.6, bw=4.0, cy=0;
    const gapH=metal? 0 : clamp(Eg*0.55,0.3,3.0);
    const vTop=cy-gapH/2, cBot=cy+gapH/2;
    // валентная зона
    ctx.fillStyle=acc; ctx.globalAlpha=.3;
    ctx.fillRect(bx,vTop-1.6,bw,1.6); ctx.globalAlpha=1;
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(bx,vTop-1.6,bw,1.6);
    v.label(ctx,'валентная зона (заполнена)',bx,vTop-1.6,4,-6,acc);
    // зона проводимости
    ctx.fillStyle=meas; ctx.globalAlpha=.16;
    ctx.fillRect(bx,cBot,bw,1.6); ctx.globalAlpha=1;
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(bx,cBot,bw,1.6);
    v.label(ctx,'зона проводимости (пустая)',bx,cBot+1.6,4,-6,meas);
    // запрещённая зона
    if(!metal){
      ctx.fillStyle=ink3; ctx.globalAlpha=.1; ctx.fillRect(bx,vTop,bw,gapH); ctx.globalAlpha=1;
      v.arrow(ctx,bx+bw*0.5,vTop,bx+bw*0.5,cBot,dang);
      v.label(ctx,`Eg = ${Eg} эВ`,bx+bw*0.5,cy,8,0,dang);
      v.label(ctx,'запрещённая зона',bx+bw*0.5,cy,8,16,ink3);
    } else {
      v.label(ctx,'зоны перекрываются — щели нет',bx+bw*0.5,cy,-60,0,dang);
    }
    // примесные уровни
    if(!metal && p.dope!=='none'){
      const y=(p.dope==='n')? cBot-0.28 : vTop+0.28;
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(4),v.lw(3)]);
      for(let i=0;i<4;i++){
        const x=bx+0.5+i*0.9;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+0.5,y); ctx.stroke();
      }
      ctx.setLineDash([]);
      v.label(ctx,p.dope==='n'?'донорные уровни — под самой зоной проводимости'
                             :'акцепторные уровни — над валентной зоной',bx,y,4,p.dope==='n'?-8:16,sec);
    }
    // носители
    if(p.carriers){
      const nrel=metal? 1 : this.ni(p);
      const nEl=metal? 10 : clamp(Math.round(nrel*4e6),0,9) + (p.dope==='n'?4:0);
      const nHole=metal? 0 : clamp(Math.round(nrel*4e6),0,9) + (p.dope==='p'?4:0);
      // электроны в зоне проводимости
      ctx.fillStyle=meas;
      for(let i=0;i<nEl;i++){
        const x=bx+0.35+((i*0.44+s.ph*0.25)%(bw-0.7));
        const y=cBot+0.35+((i*0.31)%1.0);
        ctx.beginPath(); ctx.arc(x,y,v.lw(3),0,7); ctx.fill();
      }
      // дырки в валентной зоне
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.6);
      for(let i=0;i<nHole;i++){
        const x=bx+0.35+((i*0.44+s.ph*0.18)%(bw-0.7));
        const y=vTop-0.35-((i*0.29)%1.0);
        ctx.beginPath(); ctx.arc(x,y,v.lw(3),0,7); ctx.stroke();
      }
      v.label(ctx,`электронов сверху: ${nEl}, дырок снизу: ${nHole}`,bx,vTop-1.6,4,20,ink3);
    }
    // график проводимости от температуры
    if(p.curve){
      const gx=0.6, gy=-2.6, gw2=4.6, gh=4.4;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw2,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'проводимость',gx,gy+gh,4,-8,ink3);
      v.label(ctx,'температура',gx+gw2,gy,-56,16,ink3);
      // кривая
      let vals=[];
      for(let i=0;i<=100;i++){ const T=50+i*7.5; vals.push(this.sigma({...p,T})); }
      const mx=Math.max(...vals)||1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2); ctx.beginPath();
      vals.forEach((val,i)=>{ const x=gx+gw2*i/100, y=gy+gh*0.9*(val/mx);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke();
      // текущая точка
      const idx=clamp(Math.round((p.T-50)/7.5),0,100);
      ctx.fillStyle=meas; ctx.beginPath();
      ctx.arc(gx+gw2*idx/100, gy+gh*0.9*(vals[idx]/mx), v.lw(3.6),0,7); ctx.fill();
      v.label(ctx, metal? 'у металла проводимость ПАДАЕТ с нагревом'
                        : 'у полупроводника проводимость РАСТЁТ с нагревом',
        gx,gy,4,32, metal?dang:acc);
      v.label(ctx, metal? 'мешают колебания решётки'
                        : 'тепло забрасывает электроны через щель',
        gx,gy,4,48,ink3);
    }
    v.label(ctx,this.kind(p),-4.6,-3.4,0,0,ink3);
  }
}
,

/* ================== ГЛ.29: РАЗМЕРЫ И СТРОЕНИЕ ЯДЕР ================= */
nucleus:{
  title:'Ядро: размеры и состав',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'A',label:'Массовое число A',min:1,max:238,step:1,default:56},
    {key:'Z',label:'Число протонов Z',min:1,max:92,step:1,default:26},

    {type:'group',label:'Показывать'},
    {key:'balls',label:'Нуклоны',type:'check',default:true},
    {key:'map',  label:'Карта стабильных ядер',type:'check',default:true}
  ],
  R0:1.2, u:1.66053907e-27,                     // фм и кг
  N(p){ return Math.max(0,p.A-p.Z); },
  /* радиус ядра: R = R₀·A^(1/3) */
  R(p){ return this.R0*Math.pow(p.A,1/3); },    // фм
  volume(p){ const R=this.R(p)*1e-15; return 4/3*Math.PI*R*R*R; },
  /* плотность ядерного вещества — одинакова у всех ядер */
  density(p){ return p.A*this.u/this.volume(p); },
  /* линия стабильности: у лёгких N≈Z, у тяжёлых нейтронов больше */
  stableZ(A){ return A/(1.98+0.0155*Math.pow(A,2/3)); },
  stable(p){ return Math.abs(p.Z-this.stableZ(p.A))<Math.max(1.2,p.A*0.022); },
  ratio(p){ return this.N(p)/Math.max(p.Z,1); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    return [['массовое число A',p.A,''],
      ['протонов Z',Math.min(p.Z,p.A),''],
      ['нейтронов N = A − Z',this.N(p),''],
      ['отношение N/Z',this.ratio(p),''],
      ['радиус R = R₀·∛A',this.R(p),'фм'],
      ['R₀',this.R0,'фм'],
      ['объём',this.volume(p),'м³'],
      ['плотность ядерного вещества',this.density(p),'кг/м³'],
      ['плотность одинакова у всех ядер',1,'~2,3·10¹⁷ кг/м³'],
      ['ближе всего к стабильности Z ≈',this.stableZ(p.A),''],
      ['устойчиво ли',this.stable(p)?1:0,this.stable(p)?'да, вблизи линии стабильности':'нет — такое ядро распадётся']];
  },
  graphs:[],
  presets:[
    {name:'Гелий-4',values:{A:4,Z:2}},
    {name:'Железо-56 — самое прочное',values:{A:56,Z:26}},
    {name:'Свинец-208',values:{A:208,Z:82}},
    {name:'Уран-238',values:{A:238,Z:92}},
    {name:'Нестабильное ядро: слишком мало нейтронов',values:{A:238,Z:60}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const CX=-3.0, Z=Math.min(p.Z,p.A), N=this.N(p);
    const Rvis=0.45*Math.pow(p.A,1/3);
    // ядро
    ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.arc(CX,0.6,Rvis,0,7); ctx.stroke(); ctx.globalAlpha=1;
    if(p.balls){
      /* Нуклоны укладываем по спирали с золотым углом — она равномерно заполняет круг.
         Размер шарика привязан к ПЛОЩАДИ: число нуклонов растёт как A, а площадь ядра
         как A^(2/3), поэтому фиксированный радиус неизбежно приводил к слипанию.
         Берём r так, чтобы суммарная площадь шариков была постоянной долей площади ядра,
         тогда между ними всегда остаются просветы. */
      const tot=Math.min(p.A,238);
      const fill=0.26;                                   // доля площади под нуклонами
      const rN=clamp(Rvis*Math.sqrt(fill/Math.max(tot,1)), Rvis*0.028, Rvis*0.30);
      for(let i=0;i<tot;i++){
        const t=(i+0.5)/tot;
        const rr=Rvis*0.88*Math.sqrt(t);
        const a=i*2.39996+s.ph*0.15;
        const x=CX+rr*Math.cos(a), y=0.6+rr*Math.sin(a);
        ctx.fillStyle=(i<Z)?dang:meas;
        ctx.globalAlpha=.92;
        ctx.beginPath(); ctx.arc(x,y,rN,0,7); ctx.fill();
        ctx.globalAlpha=1;
      }
      v.label(ctx,`протонов ${Z}`,CX,0.6-Rvis,-24,-14,dang);
      v.label(ctx,`нейтронов ${N}`,CX,0.6+Rvis,-26,18,meas);
    }
    v.label(ctx,`A = ${p.A}, R = ${this.R(p).toFixed(2)} фм`,CX,0.6,-46,Rvis*20+36,ink3);
    v.label(ctx,'нуклоны уложены плотно — как капля жидкости',CX,0.6,-104,Rvis*20+52,ink3);

    // карта стабильности N–Z
    if(p.map){
      const gx=0.6, gy=-2.6, gw=4.8, gh=4.8, Amax=250;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'N (нейтроны)',gx,gy+gh,4,-8,ink3);
      v.label(ctx,'Z (протоны)',gx+gw,gy,-56,16,ink3);
      const X=n=>gx+gw*clamp(n/150,0,1), Y=z=>gy+gh*clamp(z/100,0,1);
      // линия N = Z
      ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(X(0),Y(0)); ctx.lineTo(X(100),Y(100)); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'N = Z',X(95),Y(95),6,-4,ink3);
      // дорожка стабильности
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.4); ctx.beginPath();
      for(let A=2;A<=Amax;A+=2){
        const z=this.stableZ(A), n=A-z;
        const x=X(n), y=Y(z);
        A===2?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();
      v.label(ctx,'дорожка стабильности',X(90),Y(60),4,0,acc);
      v.label(ctx,'у тяжёлых ядер нейтронов заметно больше',X(60),Y(20),-10,26,ink3);
      // текущее ядро
      ctx.fillStyle=this.stable(p)?meas:dang;
      ctx.beginPath(); ctx.arc(X(N),Y(Z),v.lw(4.5),0,7); ctx.fill();
      v.label(ctx,`A=${p.A}`,X(N),Y(Z),8,-6,this.stable(p)?meas:dang);
    }
    v.label(ctx,`плотность ядра ${this.density(p).toExponential(2)} кг/м³ — одна и та же у всех ядер`,-5.4,-3.4,0,0,acc);
    if(!this.stable(p)) v.label(ctx,'такое сочетание Z и A неустойчиво — ядро распадётся',-5.4,-3.4,0,16,dang);
  }
},

/* ================= ГЛ.29: ЭНЕРГИЯ СВЯЗИ, ДЕЛЕНИЕ И СИНТЕЗ ================= */
binding:{
  title:'Энергия связи: почему делятся тяжёлые и сливаются лёгкие',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'A',label:'Массовое число A',min:2,max:238,step:1,default:56},

    {type:'group',label:'Показывать'},
    {key:'data', label:'Измеренные значения',type:'check',default:true},
    {key:'zones',label:'Области синтеза и деления',type:'check',default:true}
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
  init(p){ return {t:0,event:null,__stop:null}; },
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
        ['что выгодно',0,'ДЕЛЕНИЕ: осколки связаны прочнее']);
    } else if(p.A<=20){
      out.push(['что выгодно',0,'СИНТЕЗ: слияние даёт более прочное ядро']);
    } else {
      out.push(['что выгодно',0,'ничего — ядро уже вблизи максимума прочности']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Гелий-4',values:{A:4}},
    {name:'Железо-56: вершина кривой',values:{A:56}},
    {name:'Уран-235: топливо реакторов',values:{A:235}},
    {name:'Свинец-208',values:{A:208}},
    {name:'Дейтерий: топливо синтеза',values:{A:2}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const gx=-5.2, gy=-2.4, gw=10.4, gh=4.6, Amax=250, Bmax=10;
    const X=A=>gx+gw*clamp(A/Amax,0,1), Y=b=>gy+gh*clamp(b/Bmax,0,1);
    // оси
    ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
    ctx.globalAlpha=1;
    v.label(ctx,'энергия связи на нуклон, МэВ',gx,gy+gh,4,-8,ink3);
    v.label(ctx,'массовое число A',gx+gw,gy,-84,16,ink3);
    for(let A=0;A<=250;A+=50){ v.label(ctx,`${A}`,X(A),gy,-6,14,ink3); }
    for(let b=2;b<=8;b+=2){
      ctx.strokeStyle=ink3; ctx.globalAlpha=.25; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,Y(b)); ctx.lineTo(gx+gw,Y(b)); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,`${b}`,gx,Y(b),-14,4,ink3);
    }
    // зоны
    const pk=this.peak();
    if(p.zones){
      ctx.fillStyle=acc; ctx.globalAlpha=.1; ctx.fillRect(gx,gy,X(pk.A)-gx,gh); ctx.globalAlpha=1;
      ctx.fillStyle=dang; ctx.globalAlpha=.1; ctx.fillRect(X(pk.A),gy,gx+gw-X(pk.A),gh); ctx.globalAlpha=1;
      v.label(ctx,'СИНТЕЗ выгоден',X(pk.A/2),gy+gh,-40,10,acc);
      v.label(ctx,'ДЕЛЕНИЕ выгодно',X((pk.A+Amax)/2),gy+gh,-46,10,dang);
    }
    // кривая
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
    for(let A=20;A<=Amax;A++){ const x=X(A), y=Y(this.BperA(A)); A===20?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.stroke();
    // измеренные точки
    if(p.data){
      ctx.fillStyle=meas;
      for(const [A,b] of this.measured){
        ctx.beginPath(); ctx.arc(X(A),Y(b),v.lw(3),0,7); ctx.fill();
      }
      v.label(ctx,'точки — измеренные значения',gx+gw,gy+gh,-124,0,meas);
      v.label(ctx,'кривая — формула Вайцзеккера (для лёгких ядер неточна)',gx+gw,gy+gh,-190,16,ink3);
    }
    // максимум
    ctx.strokeStyle=acc; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.moveTo(X(pk.A),gy); ctx.lineTo(X(pk.A),Y(pk.B)); ctx.stroke(); ctx.setLineDash([]);
    v.label(ctx,`максимум: A ≈ ${pk.A} (железо)`,X(pk.A),Y(pk.B),-30,-14,acc);
    // текущее ядро
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(X(p.A),Y(this.BperA(p.A)),v.lw(4.5),0,7); ctx.fill();
    v.label(ctx,`A = ${p.A}: ${this.BperA(p.A).toFixed(2)} МэВ/нуклон`,X(p.A),Y(this.BperA(p.A)),8,-8,dang);
    // пояснение
    let txt;
    if(p.A>=100) txt=`при делении пополам выделится около ${this.fissionGain(p.A).toFixed(0)} МэВ`;
    else if(p.A<=20) txt='слияние лёгких ядер даёт огромный выигрыш — это топка звёзд';
    else txt='ядро вблизи вершины: ни делить, ни сливать невыгодно';
    v.label(ctx,txt,0,-3.4,-Math.round(txt.length*3),0,ink3);
    v.label(ctx,'к железу энергия связи максимальна — дальше ядро прочнее не сделать',0,-3.4,-160,16,ink3);
  }
},

/* ================= ГЛ.29: РАДИОАКТИВНЫЙ РАСПАД ================= */
decay:{
  title:'Радиоактивный распад: закон и виды',
  params:[
    {key:'type',label:'Вид распада',type:'select',default:'alpha',
     options:[{v:'alpha',t:'Альфа-распад'},{v:'beta',t:'Бета-минус распад'},{v:'gamma',t:'Гамма-излучение'}]},
    {key:'A',label:'Массовое число A',min:4,max:238,step:1,default:238},
    {key:'Z',label:'Заряд Z',min:2,max:92,step:1,default:92},
    {key:'half',label:'Период полураспада T½',unit:'с',min:0.5,max:60,step:0.5,default:10},

    {type:'group',label:'Показывать'},
    {key:'curve',label:'Кривая распада',type:'check',default:true},
    {key:'atoms',label:'Ядра в образце',type:'check',default:true}
  ],
  /* постоянная распада: λ = ln2 / T½ */
  lam(p){ return Math.LN2/p.half; },
  /* закон радиоактивного распада: N = N₀·e^(−λt) */
  frac(p,t){ return Math.exp(-this.lam(p)*t); },
  halves(p,t){ return t/p.half; },
  /* среднее время жизни τ = 1/λ */
  tau(p){ return 1/this.lam(p); },
  /* что получается после распада */
  product(p){
    if(p.type==='alpha') return {A:p.A-4, Z:p.Z-2, emitted:'ядро гелия (α-частица)'};
    if(p.type==='beta')  return {A:p.A,   Z:p.Z+1, emitted:'электрон и антинейтрино'};
    return {A:p.A, Z:p.Z, emitted:'гамма-квант (состав не меняется)'};
  },
  init(p){ return {t:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const f=this.frac(p,s.t), pr=this.product(p);
    return [['t',s.t,'с'],
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
      ['через три периода',12.5,'%']];
  },
  graphs:[
    {label:'Доля оставшихся ядер',unit:'%',series:['N/N₀'],get(s,p){ return [SIMS.decay.frac(p,s.t)*100,null]; }},
    {label:'Активность',unit:'отн.',series:['A'],get(s,p){ return [SIMS.decay.lam(p)*SIMS.decay.frac(p,s.t),null]; }}
  ],
  presets:[
    {name:'Альфа-распад урана-238',values:{type:'alpha',A:238,Z:92,half:10}},
    {name:'Бета-распад: нейтрон стал протоном',values:{type:'beta',A:14,Z:6,half:10}},
    {name:'Гамма-излучение: состав не меняется',values:{type:'gamma',A:60,Z:27,half:10}},
    {name:'Короткий период полураспада',values:{type:'alpha',A:238,Z:92,half:2}},
    {name:'Долгий период полураспада',values:{type:'alpha',A:238,Z:92,half:40}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const f=this.frac(p,s.t), pr=this.product(p);
    // схема превращения
    const CY=2.6;
    ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(-4.2,CY,0.42,0,7); ctx.fill();
    v.label(ctx,`${p.A}`,-4.2,CY,-8,-1,'#fff');
    v.label(ctx,`Z=${p.Z}`,-4.2,CY,-14,20,ink3);
    v.arrow(ctx,-3.5,CY,-2.4,CY,ink3);
    ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(-1.7,CY,0.42,0,7); ctx.fill();
    v.label(ctx,`${pr.A}`,-1.7,CY,-8,-1,'#fff');
    v.label(ctx,`Z=${pr.Z}`,-1.7,CY,-14,20,ink3);
    // вылетающая частица
    if(p.type==='alpha'){
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(-0.6,CY+0.7,0.2,0,7); ctx.fill();
      v.label(ctx,'α',-0.6,CY+0.7,-4,4,'#fff');
      v.label(ctx,'ядро гелия: A−4, Z−2',-0.6,CY+0.7,14,0,meas);
    } else if(p.type==='beta'){
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(-0.6,CY+0.7,0.16,0,7); ctx.fill();
      v.label(ctx,'e⁻ и антинейтрино: A тот же, Z+1',-0.6,CY+0.7,14,0,meas);
      v.label(ctx,'нейтрон в ядре превратился в протон',-0.6,CY+0.7,14,16,ink3);
    } else {
      ctx.strokeStyle=sec; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=40;i++){ const x=-1.1+i*0.04, y=CY+0.7+0.12*Math.sin(i*0.9);
        i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
      ctx.stroke();
      v.label(ctx,'гамма-квант: A и Z не меняются',0.6,CY+0.7,4,0,sec);
      v.label(ctx,'ядро просто сбрасывает лишнюю энергию',0.6,CY+0.7,4,16,ink3);
    }
    // кривая распада
    if(p.curve){
      const gx=-5.2, gy=-2.8, gw=6.4, gh=4.0, Tmax=p.half*5;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke();
      ctx.globalAlpha=1;
      v.label(ctx,'N/N₀',gx,gy+gh,-4,-10,ink3);
      v.label(ctx,'время',gx+gw,gy,-30,16,ink3);
      const X=t=>gx+gw*clamp(t/Tmax,0,1), Y=fr=>gy+gh*fr;
      // экспонента
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=200;i++){ const t=Tmax*i/200;
        i?ctx.lineTo(X(t),Y(this.frac(p,t))):ctx.moveTo(X(t),Y(this.frac(p,t))); }
      ctx.stroke();
      // отметки периодов полураспада
      for(let k=1;k<=4;k++){
        const t=k*p.half, fr=Math.pow(0.5,k);
        ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(X(t),gy); ctx.lineTo(X(t),Y(fr)); ctx.lineTo(gx,Y(fr)); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
        v.label(ctx,`${k}·T½`,X(t),gy,-10,14,ink3);
        v.label(ctx,`${(fr*100).toFixed(fr<0.2?1:0)}%`,gx,Y(fr),-32,4,ink3);
      }
      // текущий момент
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(X(Math.min(s.t,Tmax)),Y(f),v.lw(4),0,7); ctx.fill();
      v.label(ctx,`осталось ${(f*100).toFixed(1)} %`,X(Math.min(s.t,Tmax)),Y(f),8,-6,dang);
    }
    /* ОБРАЗЕЦ ЯДЕР. Подписи вынесены за пределы сетки: пояснение сверху,
       расшифровка снизу — раньше строки ложились прямо на кружки. */
    if(p.atoms){
      const bx=2.0, by=-2.5, cols=9, rows=9, stp=0.40;
      const topY=by+(rows-1)*stp;
      let aliveCount=0;
      for(let i=0;i<cols;i++) for(let j=0;j<rows;j++){
        const idx=i*rows+j;
        // устойчивый «порядок распада»: картинка не скачет от кадра к кадру
        const seed=((idx*2654435761)%81)/81;
        const alive=seed<f;
        if(alive) aliveCount++;
        const x=bx+i*stp, y=by+j*stp, r=v.lw(3.4);
        if(alive){
          ctx.fillStyle=dang;
          ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
        } else {
          // распавшееся — пустое кольцо: разница видна сразу, без игры прозрачностью
          ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.2);
          ctx.beginPath(); ctx.arc(x,y,r*0.85,0,7); ctx.stroke(); ctx.globalAlpha=1;
        }
      }
      // рамка образца
      ctx.strokeStyle=ink3; ctx.globalAlpha=.25; ctx.lineWidth=v.lw(1);
      ctx.strokeRect(bx-0.3,by-0.3,(cols-1)*stp+0.6,(rows-1)*stp+0.6);
      ctx.globalAlpha=1;
      // пояснение — над рамкой
      v.label(ctx,'какое ядро распадётся — предсказать нельзя,',bx-0.3,topY+0.3,0,-24,ink3);
      v.label(ctx,'но доля оставшихся подчиняется точному закону',bx-0.3,topY+0.3,0,-8,ink3);
      // расшифровка — под рамкой
      ctx.fillStyle=dang;
      ctx.beginPath(); ctx.arc(bx-0.1,by-0.62,v.lw(3.4),0,7); ctx.fill();
      v.label(ctx,'— ещё не распалось',bx-0.1,by-0.62,10,4,ink3);
      ctx.strokeStyle=ink3; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1.2);
      ctx.beginPath(); ctx.arc(bx-0.1,by-1.02,v.lw(2.9),0,7); ctx.stroke(); ctx.globalAlpha=1;
      v.label(ctx,'— уже распалось',bx-0.1,by-1.02,10,4,ink3);
      v.label(ctx,`осталось ${aliveCount} ядер из ${cols*rows}`,bx-0.3,by-1.42,0,4,dang);
    }
    v.label(ctx,`N = N₀·e^(−λt),  λ = ln2/T½ = ${this.lam(p).toFixed(4)} 1/с`,-5.2,-3.6,0,0,acc);
  }
}
,

/* ================== ГЛ.31: ЧЕТЫРЕ ФУНДАМЕНТАЛЬНЫХ ВЗАИМОДЕЙСТВИЯ ================= */
forces:{
  title:'Четыре взаимодействия и слабый распад',
  params:[
    {key:'mode',label:'Что показываем',type:'select',default:'decay',
     options:[{v:'decay',t:'Слабый распад: живой ансамбль нейтронов'},
              {v:'compare',t:'Четыре силы: кто побеждает на каком расстоянии'}]},

    {type:'group',label:'Распад нейтрона'},
    {key:'N',    label:'Сколько нейтронов в начале',min:20,max:2000,step:20,default:400},
    {key:'boost',label:'Ускорение времени распада',unit:'×',min:1,max:600,step:1,default:120},
    {key:'spec', label:'Спектр энергий электрона',type:'check',default:true},
    {key:'curve',label:'Кривая N(t) и теория',type:'check',default:true},
    {key:'vec',  label:'Импульсы разлёта в последнем распаде',type:'check',default:true},

    {type:'group',label:'Сравнение сил'},
    {key:'logr', label:'Расстояние между двумя протонами: показатель степени',
     unit:'(r = 10^x м)',min:-19,max:0,step:0.1,default:-18},
    {key:'names',label:'Подписи кривых',type:'check',default:true},

    {type:'group',label:'Остановка таймера'},
    {key:'tStop',label:'В момент t (0 — выкл)',unit:'с',min:0,max:600,step:0.1,default:0}
  ],

  /* ---------- СЛАБЫЙ РАСПАД: n → p + e⁻ + ν̄ₑ ----------
     Массы покоя в МэВ. Разность масс нейтрона и протона уходит на массу
     электрона и на кинетическую энергию, которую делят между собой электрон и
     антинейтрино. */
  mn:939.56542, mp:938.27209, me:0.51099895,
  halfLife:611,                                   // период полураспада свободного нейтрона, с
  Q(){ return this.mn-this.mp-this.me; },         // 0.782 МэВ — вся доступная кинетическая энергия
  /* Форма бета-спектра (Ферми, без кулоновской поправки):
         S(T) ∝ p·E·(Q−T)²,   E = T + mₑ,  p = √(T² + 2Tmₑ).
     Именно ЭТА непрерывность и заставила Паули в 1930 году придумать
     нейтрино: в распаде на две частицы энергия электрона была бы одна и та
     же, а опыт давал размазанный спектр. */
  spec(T){
    const Q=this.Q(); if(T<=0||T>=Q) return 0;
    const E=T+this.me, pc=Math.sqrt(T*(T+2*this.me));
    return pc*E*(Q-T)*(Q-T);
  },
  specMax(){
    if(this._sm) return this._sm;
    let m=0; const Q=this.Q();
    for(let i=1;i<400;i++) m=Math.max(m,this.spec(Q*i/400));
    return this._sm=m;
  },
  /* Разыгрываем энергию электрона по спектру методом отбора. */
  drawT(){
    const Q=this.Q(), M=this.specMax();
    for(let i=0;i<200;i++){
      const T=Math.random()*Q;
      if(Math.random()*M<=this.spec(T)) return T;
    }
    return Q/3;
  },

  /* ---------- ЧЕТЫРЕ СИЛЫ между двумя протонами ----------
     Считаем настоящие силы в ньютонах, а не «условные единицы».
       электромагнитная  F = k e²/r²                     — дальнодействующая;
       гравитационная    F = G mₚ²/r²                    — дальнодействующая;
       сильная (Юкава)   F ≈ A e^(−r/r₀)/r², r₀ ≈ 1.4 фм — обрывается за ядром;
       слабая            F ≈ B e^(−r/r_w)/r², r_w ≈ 0.0025 фм — обрывается сразу.
     Экспоненты — это и есть «конечный радиус действия»: переносчик массивный,
     поэтому за своим комптоновским размером сила гаснет как e^(−r/r₀). */
  KE2:2.307e-28,                                  // k·e², Н·м²
  GM2:1.867e-64,                                  // G·mₚ², Н·м²
  R0:1.4e-15, RW:2.5e-18,
  A(){ return 100*this.KE2; },                    // сильное ≈ в 100 раз сильнее кулона на 1 фм
  B(){ return 1e-6*this.A(); },                   // слабое ≈ 10⁻⁶ от сильного
  F(kind,r){
    if(!(r>0)) return NaN;
    switch(kind){
      case 'em':     return this.KE2/(r*r);
      case 'grav':   return this.GM2/(r*r);
      case 'strong': return this.A()*Math.exp(-r/this.R0)/(r*r);
      case 'weak':   return this.B()*Math.exp(-r/this.RW)/(r*r);
    }
    return NaN;
  },
  /* Десятичный логарифм той же силы. Нужен там, где сама сила не помещается
     в double: exp(−r/R₀) при r ≫ R₀ обнуляется, а lg остаётся конечным. */
  lgF(kind,r){
    if(!(r>0)) return NaN;
    const L=Math.LN10, lr2=2*Math.log10(r);
    switch(kind){
      case 'em':     return Math.log10(this.KE2)-lr2;
      case 'grav':   return Math.log10(this.GM2)-lr2;
      case 'strong': return Math.log10(this.A())-r/this.R0/L-lr2;
      case 'weak':   return Math.log10(this.B())-r/this.RW/L-lr2;
    }
    return NaN;
  },
  KINDS:['strong','em','weak','grav'],
  INFO:{
    strong:{name:'сильное',        range:'≈10⁻¹⁵ м — размер ядра', carrier:'глюоны',
            acts:'кварки и нуклоны',        role:'держит ядро от развала'},
    em:    {name:'электромагнитное',range:'бесконечный',           carrier:'фотон',
            acts:'все заряженные частицы',  role:'держит атомы и молекулы'},
    weak:  {name:'слабое',          range:'≈10⁻¹⁸ м',              carrier:'W- и Z-бозоны',
            acts:'все частицы, включая нейтрино', role:'отвечает за бета-распад'},
    grav:  {name:'гравитационное',  range:'бесконечный',           carrier:'не обнаружен',
            acts:'всё, что имеет энергию',  role:'правит звёздами и галактиками'}
  },

  init(p){
    const nu=[];
    for(let i=0;i<p.N;i++) nu.push({x:Math.random(),y:Math.random(),alive:true,tp:0});
    return {t:0, nu, left:p.N, decayed:0, hist:new Array(40).fill(0),
            sumT:0, last:null, flash:0, trace:[[0,p.N]], event:null, __stop:null};
  },
  step(s,dt,p){
    if(s.event) return;
    const t=s.t+dt;
    if(p.tStop>0&&t>=p.tStop){ s.t=p.tStop; s.event={t:p.tStop,type:'time'};
      s.__stop=`Остановка по времени: t = ${p.tStop.toFixed(2)} с`; return; }
    s.t=t;
    if(p.mode!=='decay') return;
    if(s.nu.length!==p.N){ Object.assign(s,this.init(p)); s.t=t; return; }
    s.flash=Math.max(0,s.flash-dt*2.5);
    /* Радиоактивный распад: за время dt каждый уцелевший нейтрон распадается с
       вероятностью λ·dt, λ = ln2/T½. Никакого «расписания» — только случай,
       и всё равно получается ровная экспонента. */
    const lam=Math.LN2/this.halfLife*p.boost;
    const pd=1-Math.exp(-lam*dt);
    const Q=this.Q(), nb=s.hist.length;
    for(const q of s.nu){
      if(!q.alive||Math.random()>pd) continue;
      q.alive=false; q.tp=s.t;
      s.left--; s.decayed++;
      const T=this.drawT();                       // кинетическая энергия электрона
      s.sumT+=T;
      s.hist[Math.min(nb-1,Math.floor(T/Q*nb))]++;
      /* Импульсы. Отдачей протона (меньше килоэлектронвольта) пренебрегаем:
         электрон и антинейтрино делят импульс, а протон забирает остаток. */
      const pe=Math.sqrt(T*(T+2*this.me));         // МэВ/c
      const pv=Q-T;                                // нейтрино безмассово: p = E
      const ang=Math.random()*2*Math.PI, rel=Math.random()*2*Math.PI;
      s.last={T,pe,pv,ang,rel,x:q.x,y:q.y,t:s.t};
      s.flash=1;
    }
    /* След для кривой N(t): раньше рисовалась прямая от начала к текущей
       точке, то есть вообще не кривая. Пишем реальные отсчёты. */
    const tr=s.trace;
    if(!tr.length || s.t-tr[tr.length-1][0]>0.03){
      tr.push([s.t,s.left]);
      if(tr.length>400) tr.splice(0,tr.length-400);
    }
  },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.mode==='compare'){
      const r=Math.pow(10,p.logr);
      const out=[['t',s.t,'с'],['расстояние между протонами r',r,'м'],
                 ['оно же в фемтометрах',r*1e15,'фм']];
      for(const k of this.KINDS){
        const F=this.F(k,r);
        out.push([this.INFO[k].name+': сила',F,'Н']);
        /* Отношение Fем/F считаем в логарифмах, а не делением. Прямое деление
           на атомных расстояниях уходило в бесконечность: exp(−r/R₀) при
           r = 10⁻¹⁰ м обнуляется в double, и в панели вместо ответа стоял
           прочерк. Порядок 10^N здесь и нагляднее: он и есть та самая
           пропасть между взаимодействиями, ради которой сцена сделана. */
        out.push(['      слабее кулоновской, 10^N раз',this.lgF('em',r)-this.lgF(k,r),'']);
      }
      return out;
    }
    const Q=this.Q(), tot=s.decayed||1;
    const theory=p.N*Math.exp(-Math.LN2*s.t*p.boost/this.halfLife);
    return [['t (модельное)',s.t,'с'],
      ['прошло времени в опыте',s.t*p.boost,'с'],
      ['ускорение показа',p.boost,'×'],
      ['нейтронов осталось',s.left,''],
      ['распалось',s.decayed,''],
      ['теория N₀·2^(−t/T½)',theory,''],
      ['расхождение с теорией',s.left-theory,''],
      ['период полураспада нейтрона',this.halfLife,'с'],
      // NaN здесь намеренно: fmt() печатает для него прочерк, и строка
      // работает разделителем разделов панели, а не показанием
      ['— энергия —',NaN,'n → p + e⁻ + ν̄ₑ'],
      ['разность масс m_n − m_p',this.mn-this.mp,'МэВ'],
      ['масса покоя электрона',this.me,'МэВ'],
      ['доступная энергия Q',Q,'МэВ'],
      ['средняя энергия электрона',s.decayed?s.sumT/tot:NaN,'МэВ'],
      ['она же в долях Q',s.decayed?s.sumT/tot/Q:NaN,''],
      ['энергия последнего электрона',s.last?s.last.T:NaN,'МэВ'],
      ['осталось антинейтрино',s.last?Q-s.last.T:NaN,'МэВ']];
  },
  graphs:[
    {label:'Осталось нейтронов',unit:'шт',series:['опыт','теория'],
     get(s,p){ if(p.mode!=='decay') return [null,null];
       return [s.left, p.N*Math.exp(-Math.LN2*s.t*p.boost/SIMS.forces.halfLife)]; }},
    {label:'Средняя энергия электрона',unit:'МэВ',series:['⟨T⟩','Q'],
     get(s,p){ if(p.mode!=='decay'||!s.decayed) return [null,null];
       return [s.sumT/s.decayed, SIMS.forces.Q()]; }}
  ],
  presets:[
    {name:'Распад: 400 нейтронов, показ ×120',values:{mode:'decay',N:400,boost:120,tStop:0}},
    {name:'Мало нейтронов — виден чистый случай',values:{mode:'decay',N:40,boost:120,tStop:0}},
    {name:'Много нейтронов — идеальная экспонента',values:{mode:'decay',N:2000,boost:200,tStop:0}},
    {name:'Медленно: видно каждый распад',values:{mode:'decay',N:200,boost:20,tStop:0}},
    {name:'Учебный порядок сил (r = 10⁻¹⁸ м)',values:{mode:'compare',logr:-18}},
    {name:'Силы внутри ядра (r = 1 фм): слабое уже вымерло',values:{mode:'compare',logr:-15}},
    {name:'Силы в атоме (r = 10⁻¹⁰ м): осталось два',values:{mode:'compare',logr:-10}},
    {name:'Силы в быту (r = 1 м)',values:{mode:'compare',logr:0}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    // режимы очень разные по высоте: сравнение сил длиннее из-за пояснений
    const spanY = (p.mode==='compare') ? 10.6 : 11.6;
    const scale=clamp(Math.min((W-60)/(13.6*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:0, y:(p.mode==='compare')? 1.2 : -0.35, scale};
  },

  draw(ctx,s,v,p){
    if(p.mode==='compare') return this.drawCompare(ctx,s,v,p);
    return this.drawDecay(ctx,s,v,p);
  },

  /* ============ РЕЖИМ 1: ЖИВОЙ АНСАМБЛЬ НЕЙТРОНОВ ============ */
  drawDecay(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'),
          ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const mid=t=>-Math.round(String(t).length*3.05);
    const Q=this.Q();

    /* Сцена поделена на четыре непересекающиеся полосы: ансамбль слева сверху,
       кривая N(t) справа сверху, разлёт импульсов справа снизу, спектр во всю
       ширину внизу. Раньше подписи трёх блоков сходились в одной точке. */

    // ---------- ансамбль: нейтроны гаснут, протоны остаются ----------
    const bx=-6.6, by=0.9, bw=5.9, bh=3.5;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6); ctx.strokeRect(bx,by,bw,bh);
    const r=clamp(1.5/Math.sqrt(p.N),0.035,0.12);
    for(const q of s.nu){
      const x=bx+0.12+q.x*(bw-0.24), y=by+0.12+q.y*(bh-0.24);
      ctx.fillStyle=q.alive?meas:dang; ctx.globalAlpha=q.alive?.95:.45;
      ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
      if(!q.alive && s.t-q.tp<0.35){                 // вспышка в момент распада
        ctx.globalAlpha=1; ctx.strokeStyle=ok; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.arc(x,y,r+0.12+(s.t-q.tp)*0.9,0,7); ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    /* Счётчики разнесены по разным краям ящика: рядом они сталкивались и
       автораскладка загоняла один из них внутрь рисунка. */
    v.label(ctx,`нейтронов ${s.left}`,bx,by+bh,2,-10,meas);
    const pl=`протонов ${s.decayed}`;
    v.label(ctx,pl,bx+bw,by,-Math.round(pl.length*6.2)-2,15,dang);
    v.label(ctx,`ускорено в ${p.boost}× · в опыте прошло ${(s.t*p.boost/60).toFixed(1)} мин`,
      bx,by,4,15,ink3);

    // ---------- кривая N(t): опыт против теории ----------
    if(p.curve){
      const gx=0.5, gy=2.7, gw=6.1, gh=1.7;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy);
      ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke(); ctx.globalAlpha=1;
      const Tmax=Math.max(s.t,this.halfLife/p.boost*2.4);
      const X=t=>gx+gw*clamp(t/Tmax,0,1), Y=n=>gy+gh*clamp(n/p.N,0,1);
      ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.3);
      ctx.beginPath();
      for(let i=0;i<=60;i++){ const t=Tmax*i/60;
        const n=p.N*Math.exp(-Math.LN2*t*p.boost/this.halfLife);
        i?ctx.lineTo(X(t),Y(n)):ctx.moveTo(X(t),Y(n)); }
      ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2);
      ctx.beginPath();
      s.trace.forEach((q,i)=>{ const x=X(q[0]),y=Y(q[1]); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
      ctx.stroke();
      ctx.fillStyle=meas; ctx.beginPath(); ctx.arc(X(s.t),Y(s.left),v.lw(3.2),0,7); ctx.fill();
      const th=this.halfLife/p.boost;
      if(th<=Tmax){
        ctx.strokeStyle=ok; ctx.globalAlpha=.7; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(X(th),gy); ctx.lineTo(X(th),Y(p.N/2)); ctx.lineTo(gx,Y(p.N/2));
        ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
        v.label(ctx,'T½',X(th),gy,-7,14,ok);
        v.label(ctx,'N₀/2',gx,Y(p.N/2),-32,0,ok);
      }
      v.label(ctx,'осталось нейтронов: опыт и теория',gx,gy+gh,2,-9,ink3);
    }

    // ---------- последний распад: сумма импульсов равна нулю ----------
    if(p.vec && s.last){
      const cx=3.5, cy=1.5, K=0.8/Math.max(Q,1e-6);
      const a1=s.last.ang, a2=s.last.ang+s.last.rel;
      const ex=Math.cos(a1)*s.last.pe*K, ey=Math.sin(a1)*s.last.pe*K;
      const vx=Math.cos(a2)*s.last.pv*K, vy=Math.sin(a2)*s.last.pv*K;
      const px=-(ex+vx), py=-(ey+vy);
      ctx.globalAlpha=.4+0.6*s.flash;
      v.arrow(ctx,cx,cy,cx+ex,cy+ey,acc);
      v.arrow(ctx,cx,cy,cx+vx,cy+vy,ink3);
      v.arrow(ctx,cx,cy,cx+px,cy+py,dang);
      ctx.globalAlpha=1;
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(cx,cy,v.lw(2.6),0,7); ctx.fill();
      v.label(ctx,`e⁻ ${s.last.T.toFixed(3)}`,cx+ex,cy+ey,ex>=0?7:-62,ey>=0?-8:11,acc);
      v.label(ctx,`ν̄ ${(Q-s.last.T).toFixed(3)}`,cx+vx,cy+vy,vx>=0?7:-58,vy>=0?-8:11,ink3);
      v.label(ctx,'p',cx+px,cy+py,px>=0?7:-14,py>=0?-8:11,dang);
      const cap='последний распад: Σp = 0';
      v.label(ctx,cap,cx,0.5,mid(cap),0,ink3);
    }

    // ---------- спектр: главное доказательство существования нейтрино ----------
    if(p.spec){
      const gx=-6.6, gy=-4.3, gw=13.2, gh=2.6, nb=s.hist.length;
      // заголовок НАД блоком: изнутри он ложился на столбики гистограммы
      v.label(ctx,'спектр энергий электрона: непрерывный, а не одна линия',gx,gy+gh+0.28,2,0,ink3);
      ctx.strokeStyle=ink3; ctx.globalAlpha=.6; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      const mx=Math.max(1,...s.hist), bwid=gw/nb;
      ctx.fillStyle=acc; ctx.globalAlpha=.5;
      for(let i=0;i<nb;i++){ const h=gh*s.hist[i]/mx; if(h>0) ctx.fillRect(gx+i*bwid,gy,bwid*0.86,h); }
      ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath();
      const M=this.specMax();
      for(let i=0;i<=120;i++){ const T=Q*i/120, y=gy+gh*this.spec(T)/M;
        i?ctx.lineTo(gx+gw*i/120,y):ctx.moveTo(gx+gw*i/120,y); }
      ctx.stroke();
      // где была бы единственная линия, если бы нейтрино не существовало
      ctx.strokeStyle=dang; ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.lineWidth=v.lw(1.8);
      ctx.beginPath(); ctx.moveTo(gx+gw,gy); ctx.lineTo(gx+gw,gy+gh); ctx.stroke(); ctx.setLineDash([]);
      v.label(ctx,'0',gx,gy,-2,14,ink3);
      v.label(ctx,`${Q.toFixed(3)} МэВ`,gx+gw,gy,-54,14,ink3);
      // вывод про красную черту — ПОД осью, чтобы не лежать на гистограмме
      const nn=`красная черта: без нейтрино электрон всегда получал бы ровно ${Q.toFixed(3)} МэВ`;
      v.label(ctx,nn,gx+gw,gy,-Math.round(nn.length*6.2),32,dang);
      if(s.decayed>4){
        const av=s.sumT/s.decayed, ax=gx+gw*av/Q;
        ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.moveTo(ax,gy); ctx.lineTo(ax,gy+gh*0.62); ctx.stroke();
        v.label(ctx,`⟨T⟩ = ${av.toFixed(3)}`,ax,gy+gh*0.62,-28,-7,meas);
      }
    }

    const fin='непрерывный спектр — прямое доказательство третьей частицы: именно поэтому Паули придумал нейтрино';
    v.label(ctx,fin,0,-5.85,mid(fin),0,ink3);
  },

  /* ============ РЕЖИМ 2: КТО ПОБЕЖДАЕТ НА КАКОМ РАССТОЯНИИ ============ */
  drawCompare(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const COL={strong:dang, em:acc, weak:sec, grav:ink3};
    const gx=-6.4, gy=-1.2, gw=12.8, gh=6.2;
    const LR0=-19, LR1=0;                          // показатель степени расстояния, м
    const LF0=-40, LF1=12;                         // показатель степени силы, Н
    const X=lr=>gx+gw*(lr-LR0)/(LR1-LR0);
    const Y=lf=>gy+gh*clamp((lf-LF0)/(LF1-LF0),0,1);

    // сетка по десятичным порядкам
    ctx.strokeStyle=ink3; ctx.globalAlpha=.16; ctx.lineWidth=v.lw(1);
    for(let lr=LR0+1;lr<=LR1;lr+=3){ ctx.beginPath(); ctx.moveTo(X(lr),gy); ctx.lineTo(X(lr),gy+gh); ctx.stroke(); }
    for(let lf=LF0;lf<=LF1;lf+=10){ ctx.beginPath(); ctx.moveTo(gx,Y(lf)); ctx.lineTo(gx+gw,Y(lf)); ctx.stroke(); }
    ctx.globalAlpha=1;
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.4);
    ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.moveTo(gx,gy); ctx.lineTo(gx,gy+gh); ctx.stroke();
    for(let lr=LR0+1;lr<=LR1;lr+=3) v.label(ctx,`10${this.sup(lr)}`,X(lr),gy,-11,14,ink3);
    v.label(ctx,'расстояние между двумя протонами, м',gx+gw/2,gy,-104,28,ink3);
    for(let lf=LF0;lf<=LF1;lf+=20) v.label(ctx,`10${this.sup(lf)} Н`,gx,Y(lf),-40,0,ink3);

    /* Кривые сил. Подпись ставим у ПРАВОГО конца каждой кривой: у кулона и
       тяготения это правый край кадра, у сильного и слабого — их обрыв, и
       подписи расходятся сами собой. Раньше все четыре лепились слева. */
    for(const k of this.KINDS){
      ctx.strokeStyle=COL[k]; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath();
      let started=false, lastX=null, lastY=null;
      for(let i=0;i<=240;i++){
        const lr=LR0+(LR1-LR0)*i/240, F=this.F(k,Math.pow(10,lr));
        if(!(F>0)){ started=false; continue; }
        const lf=Math.log10(F);
        if(lf<LF0||lf>LF1){ started=false; continue; }
        const x=X(lr), y=Y(lf);
        started?ctx.lineTo(x,y):ctx.moveTo(x,y); started=true; lastX=x; lastY=y;
      }
      ctx.stroke();
      if(p.names&&lastX!=null){
        const nm=this.INFO[k].name;
        const right = lastX > gx+gw-1.5;
        v.label(ctx,nm,lastX,lastY, right? -Math.round(nm.length*6.2)-6 : 7, -9, COL[k]);
      }
    }

    // текущее расстояние
    const lr=p.logr, r=Math.pow(10,lr);
    ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.setLineDash([v.lw(4),v.lw(4)]);
    ctx.beginPath(); ctx.moveTo(X(lr),gy); ctx.lineTo(X(lr),gy+gh); ctx.stroke(); ctx.setLineDash([]);
    for(const k of this.KINDS){
      const F=this.F(k,r); if(!(F>0)) continue;
      const lf=Math.log10(F); if(lf<LF0||lf>LF1) continue;
      ctx.fillStyle=COL[k]; ctx.beginPath(); ctx.arc(X(lr),Y(lf),v.lw(4),0,7); ctx.fill();
    }
    const rt = r<1e-12 ? `${(r*1e15).toPrecision(3)} фм` : `${r.toExponential(1)} м`;
    v.label(ctx,`r = ${rt}`,X(lr),gy+gh,-Math.round(('r = '+rt).length*3.05),-10,meas);

    /* Расстановка сил — в ПРАВОМ ВЕРХНЕМ углу самого графика: кривые падают
       слева направо, поэтому там всегда пусто, а под графиком места нет. */
    const rows=this.KINDS.map(k=>({k,F:this.F(k,r)})).sort((a,b)=>b.F-a.F);
    const lx=gx+gw-4.9, ly=gy+gh-0.15;
    v.label(ctx,'на этом расстоянии по убыванию:',lx,ly,0,0,ink3);
    rows.forEach((q,i)=>{
      const t=`${i+1}. ${this.INFO[q.k].name} — ${q.F>1e-99?q.F.toExponential(2):'≈ 0'} Н`;
      v.label(ctx,t,lx,ly,8,15+i*14,COL[q.k]);
    });

    // ---- вывод
    v.label(ctx,'у сильного и слабого конечный радиус: за ним сила гаснет как e^(−r/r₀) — на графике это обрыв',
      gx,gy,0,46,ink3);
    /* Порядок «сильное > ЭМ > слабое > тяготение» из учебника верен НЕ везде:
       это сравнение на радиусе слабого, около 10⁻¹⁸ м. Уже на фемтометре
       слабое вымерло и оказывается слабее тяготения — и это видно на графике,
       а не спрятано за словом «условно». */
    v.label(ctx,'привычный порядок сильное > ЭМ > слабое > тяготение верен на 10⁻¹⁸ м; на 1 фм слабое уже вымерло',
      gx,gy,0,60,ink3);
    v.label(ctx,'ЭМ в 10³⁶ раз сильнее тяготения, но заряды двух знаков экранируют друг друга, а масса — одного:',
      gx,gy,0,74,ink3);
    v.label(ctx,'поэтому звёздами и галактиками правит самая слабая из четырёх сил.',
      gx,gy,0,88,ink3);
  },
  sup(e){
    const m={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
    return String(e).split('').map(c=>m[c]||c).join('');
  }
},

/* ================= ГЛ.31: АНТИВЕЩЕСТВО ================= */
antimatter:{
  title:'Антивещество: аннигиляция и рождение пар',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'proc',label:'Процесс',type:'select',default:'annih',
     options:[{v:'annih',t:'Аннигиляция: e⁺ + e⁻ → 2γ'},
              {v:'pair', t:'Рождение пары: γ → e⁺ + e⁻'}]},
    {key:'Eg',label:'Энергия фотона (для рождения пары)',unit:'МэВ',min:0.2,max:5,step:0.01,default:2},

    {type:'group',label:'Показывать'},
    {key:'anim',label:'Движение частиц',type:'check',default:true},
    {key:'bal', label:'Баланс энергии',type:'check',default:true}
  ],
  me:0.51099895,                                     // энергия покоя электрона, МэВ
  /* аннигиляция покоящихся e⁺e⁻: рождаются два фотона по mc² каждый */
  Ephoton(){ return this.me; },
  Etotal(){ return 2*this.me; },
  /* порог рождения пары: нужно не меньше 2mc² */
  threshold(){ return 2*this.me; },
  canPair(p){ return p.Eg>=this.threshold(); },
  kinetic(p){ return Math.max(0,p.Eg-this.threshold()); },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; if(p.anim) s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    if(p.proc==='annih'){
      return [['процесс',0,'аннигиляция e⁺ + e⁻ → 2γ'],
        ['энергия покоя электрона mc²',this.me,'МэВ'],
        ['энергия покоя позитрона',this.me,'МэВ'],
        ['всего энергии',this.Etotal(),'МэВ'],
        ['рождается фотонов',2,''],
        ['энергия каждого фотона',this.Ephoton(),'МэВ'],
        ['проверка сохранения энергии',2*this.Ephoton(),'МэВ'],
        ['почему два, а не один',0,'иначе не сохранился бы импульс'],
        ['вещество исчезает полностью',100,'% массы → энергия']];
    }
    return [['процесс',0,'рождение пары γ → e⁺ + e⁻'],
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
    {name:'Ровно на пороге',values:{proc:'pair',Eg:1.02}},
    {name:'Энергии не хватает — пары нет',values:{proc:'pair',Eg:0.8}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(11*PX_PER_M),(H-70)/(8*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const ph=s.ph;
    /* Фотон умеет расти: grow = 0…1 задаёт, какая доля пути уже пройдена.
       Амплитуда гасится у самого начала и у переднего фронта, поэтому волна
       не появляется рубленым куском, а плавно вытягивается из точки рождения. */
    const photon=(x0,y0,x1,y1,col,grow)=>{
      const g=(grow==null)?1:clamp(grow,0,1);
      if(g<=0.004) return;
      const dx=x1-x0, dy=y1-y0, L=Math.hypot(dx,dy)||1, nx=-dy/L, ny=dx/L;
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.7);
      ctx.globalAlpha=clamp(g*2.2,0,1);
      ctx.beginPath();
      const N=80;
      for(let i=0;i<=N;i++){
        const t=i/N*g;                                  // идём только по пройденной части
        const head=clamp((g-t)/0.16,0,1);               // сглаживание переднего фронта
        const tail=clamp(t/0.10,0,1);                   // и у точки рождения
        const a=0.135*head*tail*Math.sin(t*Math.PI*8-ph*5);
        const x=x0+dx*t+nx*a, y=y0+dy*t+ny*a;
        i?ctx.lineTo(x,y):ctx.moveTo(x,y);
      }
      ctx.stroke(); ctx.globalAlpha=1;
      // головка кванта
      ctx.fillStyle=col; ctx.globalAlpha=clamp(g*3,0,1);
      ctx.beginPath(); ctx.arc(x0+dx*g,y0+dy*g,v.lw(2.6),0,7); ctx.fill();
      ctx.globalAlpha=1;
    };
    if(p.proc==='annih'){
      /* Цикл разбит на три ясные стадии, и они не перекрываются:
         сближение → вспышка в точке встречи → разлёт двух квантов.
         Раньше фотоны возникали, когда частицы ещё не сошлись. */
      const T=(ph*0.32)%1;
      const A_END=0.58, F_END=0.70, CY=0.8;
      if(T<A_END){
        // ── сближение ──
        const u=T/A_END, e=u*u;                        // к концу ускоряются
        const d=1.9*(1-e)+0.26;
        ctx.strokeStyle=ink3; ctx.globalAlpha=.25; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(-d+0.26,CY); ctx.lineTo(d-0.26,CY); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha=1;
        ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(-d,CY,0.24,0,7); ctx.fill();
        v.label(ctx,'e⁻',-d,CY,-6,4,'#fff');
        ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(d,CY,0.24,0,7); ctx.fill();
        v.label(ctx,'e⁺',d,CY,-6,4,'#fff');
        v.label(ctx,'электрон',-d,CY,-24,-18,acc);
        v.label(ctx,'позитрон (античастица)',d,CY,-34,-18,dang);
        v.label(ctx,'частица и античастица сближаются',0,CY,-72,30,ink3);
      } else if(T<F_END){
        // ── вспышка: расходящееся кольцо, без свечения и градиентов ──
        const u=(T-A_END)/(F_END-A_END);
        ctx.strokeStyle=sec; ctx.globalAlpha=(1-u)*0.9; ctx.lineWidth=v.lw(2.6*(1-u)+0.8);
        ctx.beginPath(); ctx.arc(0,CY,0.12+u*0.85,0,7); ctx.stroke();
        ctx.globalAlpha=(1-u)*0.5; ctx.lineWidth=v.lw(1.2);
        ctx.beginPath(); ctx.arc(0,CY,0.12+u*1.35,0,7); ctx.stroke();
        // короткие лучи вспышки
        ctx.globalAlpha=(1-u)*0.7; ctx.lineWidth=v.lw(1.4);
        for(let i=0;i<8;i++){ const a=i/8*2*Math.PI+0.3;
          const r0=0.16+u*0.5, r1=r0+0.3*(1-u);
          ctx.beginPath();
          ctx.moveTo(r0*Math.cos(a),CY+r0*Math.sin(a));
          ctx.lineTo(r1*Math.cos(a),CY+r1*Math.sin(a));
          ctx.stroke(); }
        ctx.globalAlpha=1;
        v.label(ctx,'встретились — масса обратилась в энергию',0,CY,-92,34,dang);
      } else {
        // ── разлёт двух квантов: волна вытягивается из точки встречи ──
        const g=(T-F_END)/(1-F_END);
        photon(0,CY,-2.9,2.3,sec,g); photon(0,CY,2.9,2.3,sec,g);
        if(g>0.45){
          ctx.globalAlpha=clamp((g-0.45)/0.3,0,1);
          v.label(ctx,'γ  0,511 МэВ',-2.9*g,CY+1.5*g,-34,-12,sec);
          v.label(ctx,'γ  0,511 МэВ', 2.9*g,CY+1.5*g,6,-12,sec);
          ctx.globalAlpha=1;
        }
        v.label(ctx,'вещество исчезло целиком — осталась только энергия',0,CY,-114,34,dang);
        v.label(ctx,'кванты уходят строго в противоположные стороны:',0,CY,-108,50,ink3);
        v.label(ctx,'так сохраняется импульс',0,CY,-58,66,ink3);
      }
      if(p.bal){
        const by=-1.6;
        v.label(ctx,'баланс энергии:',-5.0,by,0,0,ink);
        v.label(ctx,`масса покоя электрона: ${this.me.toFixed(4)} МэВ`,-5.0,by,0,20,ink3);
        v.label(ctx,`масса покоя позитрона: ${this.me.toFixed(4)} МэВ`,-5.0,by,0,36,ink3);
        v.label(ctx,`итого ${this.Etotal().toFixed(4)} МэВ = два фотона по ${this.Ephoton().toFixed(4)} МэВ`,-5.0,by,0,54,acc);
        v.label(ctx,'один фотон родиться не может: не сохранился бы импульс',-5.0,by,0,74,ink3);
      }
    } else {
      const ok=this.canPair(p);
      // налетающий фотон
      photon(-4.6,0.8,-0.6,0.8,sec);
      v.label(ctx,`γ  ${p.Eg} МэВ`,-4.6,0.8,0,-16,sec);
      // ядро
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(0,0.8,0.3,0,7); ctx.fill();
      v.label(ctx,'ядро',0,0.8,-12,26,ink3);
      if(ok){
        ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(2.4,1.9,0.24,0,7); ctx.fill();
        v.label(ctx,'e⁻',2.4,1.9,-6,4,'#fff');
        ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(2.4,-0.3,0.24,0,7); ctx.fill();
        v.label(ctx,'e⁺',2.4,-0.3,-6,4,'#fff');
        ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2);
        ctx.beginPath(); ctx.moveTo(0.3,0.8); ctx.lineTo(2.2,1.9); ctx.moveTo(0.3,0.8); ctx.lineTo(2.2,-0.3); ctx.stroke();
        v.label(ctx,'родилась пара частица + античастица',2.4,0.8,10,0,acc);
      } else {
        v.label(ctx,'пара не рождается',1.2,0.8,10,0,dang);
        v.label(ctx,`нужно минимум ${this.threshold().toFixed(3)} МэВ`,1.2,0.8,10,16,ink3);
      }
      if(p.bal){
        const by=-1.6, bx=-5.0, bw=8.0;
        // столбик энергии
        ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.2);
        ctx.strokeRect(bx,by,bw,0.5);
        const fill=clamp(p.Eg/5,0,1);
        ctx.fillStyle=ok?acc:dang; ctx.globalAlpha=.4;
        ctx.fillRect(bx,by,bw*fill,0.5); ctx.globalAlpha=1;
        // порог
        const tx=bx+bw*(this.threshold()/5);
        ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2);
        ctx.beginPath(); ctx.moveTo(tx,by-0.15); ctx.lineTo(tx,by+0.65); ctx.stroke();
        v.label(ctx,`порог 2mc² = ${this.threshold().toFixed(3)} МэВ`,tx,by,-40,-12,dang);
        v.label(ctx,`энергия фотона ${p.Eg} МэВ`,bx,by,0,-12,ink3);
        if(ok) v.label(ctx,`на массы ушло ${this.threshold().toFixed(3)}, в движение — ${this.kinetic(p).toFixed(3)} МэВ`,bx,by,0,26,acc);
        else v.label(ctx,'фотон слабее порога — энергии на массы не хватает',bx,by,0,26,dang);
      }
    }
    v.label(ctx,'у каждой частицы есть античастица: та же масса, противоположный заряд',-5.0,-3.2,0,0,ink3);
  }
},

/* ================= ГЛ.31: АДРОНЫ И КВАРКИ ================= */
quarks:{
  title:'Адроны и кварки: из чего сложены частицы',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'part',label:'Частица',type:'select',default:'p',
     options:[{v:'p',t:'Протон'},{v:'n',t:'Нейтрон'},{v:'pi+',t:'Пион π⁺'},
              {v:'pi-',t:'Пион π⁻'},{v:'lam',t:'Лямбда-гиперон Λ⁰'},{v:'e',t:'Электрон (лептон)'}]},

    {type:'group',label:'Показывать'},
    {key:'sum',  label:'Сложение зарядов',type:'check',default:true},
    {key:'table',label:'Таблица кварков и лептонов',type:'check',default:true}
  ],
  /* заряды кварков в единицах заряда электрона */
  q:{u:2/3, d:-1/3, s:-1/3, ub:-2/3, db:1/3, sb:1/3},
  qName:{u:'u',d:'d',s:'s',ub:'ū',db:'d̄',sb:'s̄'},
  /* состав частиц */
  comp:{
    p:   {name:'протон',    quarks:['u','u','d'], type:'барион', mass:938.27,  life:'стабилен'},
    n:   {name:'нейтрон',   quarks:['u','d','d'], type:'барион', mass:939.57,  life:'≈10 мин (свободный)'},
    'pi+':{name:'пион π⁺',  quarks:['u','db'],    type:'мезон',  mass:139.57,  life:'2,6·10⁻⁸ с'},
    'pi-':{name:'пион π⁻',  quarks:['ub','d'],    type:'мезон',  mass:139.57,  life:'2,6·10⁻⁸ с'},
    lam: {name:'Λ⁰-гиперон',quarks:['u','d','s'], type:'барион', mass:1115.68, life:'2,6·10⁻¹⁰ с'},
    e:   {name:'электрон',  quarks:null,          type:'лептон', mass:0.511,   life:'стабилен'}
  },
  charge(p){
    const c=this.comp[p.part];
    if(!c.quarks) return -1;
    return c.quarks.reduce((a,k)=>a+this.q[k],0);
  },
  /* барионное число: у каждого кварка 1/3 */
  baryon(p){
    const c=this.comp[p.part];
    if(!c.quarks) return 0;
    return c.quarks.reduce((a,k)=>a+(k.length>1?-1/3:1/3),0);
  },
  init(p){ return {t:0,ph:0,event:null,__stop:null}; },
  step(s,dt,p){ s.t+=dt; s.ph+=dt; },
  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const c=this.comp[p.part];
    const out=[['частица',0,c.name],
      ['класс',0,c.type],
      ['масса',c.mass,'МэВ'],
      ['время жизни',0,c.life]];
    if(c.quarks){
      out.push(['состав',0,c.quarks.map(k=>this.qName[k]).join(' ')],
        ['сумма зарядов кварков',this.charge(p),'e'],
        ['барионное число',this.baryon(p),'']);
      c.quarks.forEach((k,i)=>out.push([`  кварк ${this.qName[k]}: заряд`,this.q[k],'e']));
    } else {
      out.push(['состав',0,'неделим — лептоны не состоят из кварков'],
        ['заряд',-1,'e'],['барионное число',0,'']);
    }
    return out;
  },
  graphs:[],
  presets:[
    {name:'Протон: uud, заряд +1',values:{part:'p'}},
    {name:'Нейтрон: udd, заряд 0',values:{part:'n'}},
    {name:'Пион π⁺: кварк и антикварк',values:{part:'pi+'}},
    {name:'Лямбда: есть странный кварк',values:{part:'lam'}},
    {name:'Электрон: лептон, не делится',values:{part:'e'}}
  ],
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-70)/(12*PX_PER_M),(H-70)/(9*PX_PER_M)),0.002,30);
    return {x:0,y:0,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const c=this.comp[p.part], CX=-3.0, CY=1.2;
    // сама частица
    const RC=1.25;                                  // радиус оболочки частицы
    if(c.quarks){
      // оболочка
      ctx.strokeStyle=ink3; ctx.globalAlpha=.4; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.arc(CX,CY,RC,0,7); ctx.stroke(); ctx.globalAlpha=1;
      const n=c.quarks.length, RQ=0.62;
      const ang=i=>i/n*2*Math.PI - Math.PI/2 + s.ph*0.4;
      // СНАЧАЛА связи — чтобы линии ушли под кружки, а не поверх них
      ctx.strokeStyle=sec; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(2);
      for(let i=0;i<n;i++){
        const a1=ang(i), a2=ang((i+1)%n);
        ctx.beginPath();
        ctx.moveTo(CX+RQ*Math.cos(a1),CY+RQ*Math.sin(a1));
        ctx.lineTo(CX+RQ*Math.cos(a2),CY+RQ*Math.sin(a2));
        ctx.stroke();
      }
      ctx.globalAlpha=1;
      // затем сами кварки
      c.quarks.forEach((k,i)=>{
        const a=ang(i);
        const x=CX+RQ*Math.cos(a), y=CY+RQ*Math.sin(a);
        const anti=k.length>1;
        ctx.fillStyle=anti?dang:acc;
        ctx.beginPath(); ctx.arc(x,y,0.32,0,7); ctx.fill();
        v.label(ctx,this.qName[k],x,y,-5,4,'#fff');
        // заряд выносим НАРУЖУ по радиусу — подписи не сталкиваются при вращении
        const qv=this.q[k];
        const txt=(qv<0?'−':'+')+(Math.abs(qv)===2/3?'2/3':'1/3');
        const lx=CX+(RQ+0.52)*Math.cos(a), ly=CY+(RQ+0.52)*Math.sin(a);
        v.label(ctx,txt,lx,ly,-10,4,ink3);
      });
      v.label(ctx,'глюоны держат кварки вместе',CX,CY-RC,-72,20,sec);
    } else {
      ctx.fillStyle=acc; ctx.beginPath(); ctx.arc(CX,CY,0.34,0,7); ctx.fill();
      v.label(ctx,'e⁻',CX,CY,-7,4,'#fff');
      v.label(ctx,'точечная частица — внутренней структуры нет',CX,CY-RC,-118,20,ink3);
    }
    // название и тип — НАД оболочкой, а не внутри неё
    v.label(ctx,c.name,CX,CY+RC,-Math.round(c.name.length*3),-24,acc);
    v.label(ctx,`${c.type}, масса ${c.mass} МэВ`,CX,CY+RC,-52,-8,ink3);

    // сложение зарядов
    if(p.sum && c.quarks){
      const bx=1.0, by=2.2;
      v.label(ctx,'заряды кварков складываются:',bx,by,0,0,ink);
      const parts=c.quarks.map(k=>{ const q=this.q[k];
        return `${this.qName[k]} (${q>0?'+':'−'}${Math.abs(q)===2/3?'2/3':'1/3'})`; });
      v.label(ctx,parts.join('  +  '),bx,by,0,22,ink3);
      const ch=this.charge(p);
      v.label(ctx,`= ${ch>0?'+':''}${Math.round(ch)} — заряд ${c.name}а`,bx,by,0,44,acc);
      v.label(ctx,`барионное число: ${this.baryon(p)===1?'1 (барион)':this.baryon(p)===0?'0 (мезон)':this.baryon(p)}`,bx,by,0,68,ink3);
      v.label(ctx,c.quarks.length===3?'три кварка — это барион':'кварк и антикварк — это мезон',bx,by,0,88,ink3);
    }
    // таблица
    if(p.table){
      const tx=-5.4, ty=-1.4;
      v.label(ctx,'КВАРКИ (в свободном виде не наблюдаются)',tx,ty,0,0,dang);
      const qs=[['u','верхний','+2/3'],['d','нижний','−1/3'],['s','странный','−1/3']];
      qs.forEach((r,i)=>{
        v.label(ctx,`${r[0]} — ${r[1]}, заряд ${r[2]}`,tx,ty,10,20+i*17,ink3);
      });
      v.label(ctx,'ЛЕПТОНЫ (неделимы)',tx,ty,0,90,acc);
      const ls=[['e⁻','электрон','−1'],['νe','нейтрино','0'],['μ⁻','мюон','−1']];
      ls.forEach((r,i)=>{
        v.label(ctx,`${r[0]} — ${r[1]}, заряд ${r[2]}`,tx,ty,10,110+i*17,ink3);
      });
      v.label(ctx,'адроны (протон, нейтрон, пионы) состоят из кварков;',1.0,-1.4,0,20,ink3);
      v.label(ctx,'лептоны (электрон, нейтрино) — не состоят ни из чего',1.0,-1.4,0,38,ink3);
      v.label(ctx,'кварк невозможно выбить поодиночке: чем дальше',1.0,-1.4,0,64,dang);
      v.label(ctx,'растаскиваешь, тем сильнее притяжение',1.0,-1.4,0,80,dang);
    }
  }
}

,

/* ================== КОНСТРУКТОР МАШИН АТВУДА ================= */
atwood:{
  title:'Конструктор машин Атвуда',
  /* Время здесь ни на что не влияет: показания и графики от него не
     зависят. Движение на сцене — иллюстрация процесса, а не его ход во
     времени, поэтому часы, шкала времени и графики по времени скрыты. */
  timeless:true,
  params:[
    {key:'g',label:'Ускорение свободного падения g',unit:'м/с²',min:1,max:25,step:0.1,default:10},
    {key:'mnew',label:'Масса нового груза',unit:'кг',min:1,max:100,step:1,default:10},

    {type:'group',label:'Показывать'},
    {key:'tens', label:'Натяжения нитей',type:'check',default:true},
    {key:'accel',label:'Ускорения грузов',type:'check',default:true},
    {key:'anim', label:'Анимация движения',type:'check',default:true}
  ],
  /* ---- ХРАНИЛИЩЕ КОНСТРУКЦИИ ---- */
  db(p){
    if(!p._atw){
      p._atw={ blocks:[], items:{}, seq:1 };
      // стартовая заготовка: один неподвижный блок с двумя грузами и креплением к потолку
      const id='P1';
      p._atw.blocks.push({id,kind:'fixed',x:0,y:1.6});
      p._atw.items[id+':top']={type:'fixed'};
      p._atw.items[id+':l']={type:'mass',m:10};
      p._atw.items[id+':r']={type:'mass',m:20};
      p._atw.tool='mass';
    }
    return p._atw;
  },
  /* порты блока в порядке [несущий, левый, правый] с координатными смещениями */
  R:0.5,                                   // радиус колеса = половина клетки
  ports(b){
    /* Крепления отстоят от центра ровно на КЛЕТКУ по вертикали, а нить сходит
       с обода по касательной (±R по горизонтали). Ось Y направлена ВВЕРХ.
       Неподвижный: опора сверху, две ветви нити вниз.
       Подвижный: две ветви нити вверх (те самые боковые линии), груз снизу на оси. */
    const R=this.R;
    return b.kind==='fixed'
      ? {top:{dx:0,dy:1,carrier:true}, l:{dx:-R,dy:-1}, r:{dx:R,dy:-1}}
      : {l:{dx:-R,dy:1}, r:{dx:R,dy:1}, bot:{dx:0,dy:-1,carrier:true}};
  },
  /* Куда встанет новый блок, если подвесить его на крепление (b,port).
     Подвижный цепляется КОНЦОМ НИТИ: справа от родителя работает его левая точка
     (блок уходит на +1 клетку), слева — правая точка (−1 клетка).
     Неподвижный цепляется осью — своим верхним креплением. */
  attachPlan(b,port,kind){
    const R=this.R, pp=this.portXY(b,port);
    if(kind==='movable'){
      const useLeft = (port!=='l');                 // от правого (и центрального) — левой точкой
      const cport = useLeft?'l':'r';
      return {x: pp.x + (useLeft? R : -R), y: pp.y-1, childPort:cport};
    }
    return {x: pp.x, y: pp.y-1, childPort:'top'};    // неподвижный висит за верх
  },
  /* На какие крепления можно вешать груз.
     Верх неподвижного держит всю систему, а верхние ветви подвижного идут к опорам
     или к другим блокам — груз там не имеет смысла и ломает построение. */
  allowsMass(b,port){
    return b.kind==='fixed' ? (port==='l'||port==='r') : (port==='bot');
  },
  carrier(b){ return b.kind==='fixed'?'top':'bot'; },
  portList(b){ return b.kind==='fixed'?['top','l','r']:['l','r','bot']; },
  portXY(b,port){ const pt=this.ports(b)[port]; return {x:b.x+pt.dx, y:b.y+pt.dy}; },

  /* ---- РЕШАТЕЛЬ ---- */
  solveLinear(A,b){
    const n=A.length, m=A[0]?A[0].length:0;
    if(!n||!m) return null;
    const M=A.map((r,i)=>[...r,b[i]]);
    let row=0; const pivCol=[];
    for(let col=0; col<m && row<n; col++){
      let piv=row; for(let r=row+1;r<n;r++) if(Math.abs(M[r][col])>Math.abs(M[piv][col])) piv=r;
      if(Math.abs(M[piv][col])<1e-10) continue;
      [M[row],M[piv]]=[M[piv],M[row]];
      const d=M[row][col]; for(let c=col;c<=m;c++) M[row][c]/=d;
      for(let r=0;r<n;r++) if(r!==row){ const f=M[r][col]; if(Math.abs(f)>1e-15) for(let c=col;c<=m;c++) M[r][c]-=f*M[row][c]; }
      pivCol.push(col); row++;
    }
    for(let r=row;r<n;r++) if(Math.abs(M[r][m])>1e-7) return null;   // несовместна
    if(row<m) return {under:true};                                   // недоопределена
    const x=new Array(m).fill(0);
    for(let i=0;i<pivCol.length;i++) x[pivCol[i]]=M[i][m];
    return x;
  },
  solve(p){
    const d=this.db(p), g=p.g, blocks=d.blocks, items=d.items;
    if(!blocks.length) return {status:'empty'};
    const byId={}; for(const b of blocks) byId[b.id]=b;
    const vi={}; let nv=0;
    const V=(name)=>{ if(!(name in vi)) vi[name]=nv++; return vi[name]; };
    for(const b of blocks){ V('T:'+b.id); V('aax:'+b.id); V('a:'+b.id+':l'); V('a:'+b.id+':r');
      if(b.kind==='movable') V('Tbot:'+b.id); }
    const eqs=[]; const push=(coef,rhs)=>eqs.push([coef,rhs]);
    for(const b of blocks){
      // связь через блок: a_l + a_r = 2 a_axis
      push({['a:'+b.id+':l']:1, ['a:'+b.id+':r']:1, ['aax:'+b.id]:-2}, 0);
      const cp=this.carrier(b), cItem=items[b.id+':'+cp];
      // 'hung' — ось держит нить родителя, уравнение для неё даёт родительский блок
      if(!cItem || cItem.type==='fixed') push({['aax:'+b.id]:1}, 0);      // ось закреплена
      if(b.kind==='movable') push({['Tbot:'+b.id]:1, ['T:'+b.id]:-2}, 0); // невесомость: Tbot = 2T
    }
    // концы l/r
    for(const b of blocks){
      for(const port of ['l','r']){
        const it=items[b.id+':'+port], aVar='a:'+b.id+':'+port, Tend='T:'+b.id;
        if(!it){ push({[Tend]:1},0); continue; }
        if(it.type==='fixed') push({[aVar]:1},0);
        else if(it.type==='mass') push({[aVar]:it.m, [Tend]:1}, it.m*g);
        else if(it.type==='block'){
          const sub=byId[it.blockId]; if(!sub){ push({[Tend]:1},0); continue; }
          if(sub.kind==='fixed'){
            /* Неподвижный блок подвешен ЗА ОСЬ: ось движется вместе с концом нити,
               а невесомое колесо держат две ветви его собственной нити. */
            push({['aax:'+sub.id]:1, [aVar]:-1}, 0);
            push({[Tend]:1, ['T:'+sub.id]:-2}, 0);
          } else {
            /* Подвижный блок привязан КОНЦОМ НИТИ (узлом): это продолжение той же
               нити, поэтому натяжение общее, а ускорения в узле совпадают. */
            const cp=it.childPort||'l';
            push({['a:'+sub.id+':'+cp]:1, [aVar]:-1}, 0);
            push({[Tend]:1, ['T:'+sub.id]:-1}, 0);
          }
        }
      }
    }
    // несущий порт подвижного блока (bot)
    for(const b of blocks){
      if(b.kind!=='movable') continue;
      const it=items[b.id+':bot'], aVar='aax:'+b.id, Tbot='Tbot:'+b.id;
      if(!it){ push({[Tbot]:1},0); continue; }
      if(it.type==='fixed') push({[aVar]:1},0);
      else if(it.type==='mass') push({[aVar]:it.m, [Tbot]:1}, it.m*g);
      else if(it.type==='block'){
        const sub=byId[it.blockId]; if(!sub){ push({[Tbot]:1},0); continue; }
        if(sub.kind==='fixed'){
          push({['aax:'+sub.id]:1, [aVar]:-1}, 0);
          push({[Tbot]:1, ['T:'+sub.id]:-2}, 0);
        } else {
          const cp=it.childPort||'l';
          push({['a:'+sub.id+':'+cp]:1, [aVar]:-1}, 0);
          push({[Tbot]:1, ['T:'+sub.id]:-1}, 0);
        }
      }
    }
    const W0=nv;
    const A=eqs.map(([coef])=>{ const row=new Array(W0).fill(0);
      for(const [k,val] of Object.entries(coef)){ if(!(k in vi)){ vi[k]=nv++; } row[vi[k]]=val; } return row; });
    const W=nv; for(const row of A) while(row.length<W) row.push(0);
    const bb=eqs.map(([,rhs])=>rhs);
    const sol=this.solveLinear(A,bb);
    if(sol===null) return {status:'bad'};
    if(sol.under) return {status:'under'};
    const vars={}; for(const [k,idx] of Object.entries(vi)) vars[k]=sol[idx];
    return {status:'ok', vars};
  },
  /* проверка правильности сборки */
  validate(p){
    const d=this.db(p), blocks=d.blocks, items=d.items, prob=[];
    if(!blocks.length) return {ok:false,prob:['Сетка пуста — добавьте блок (ПКМ → инструмент)']};
    for(const b of blocks) for(const port of this.portList(b))
      if(!items[b.id+':'+port]) prob.push(`Блок «${b.id}»: свободный конец «${this.portName(b,port)}» — прикрепите груз, фиксатор или блок`);
    // блок, подвешенный на нити, опирается через родителя — это тоже опора
    for(const b of blocks) if(items[b.id+':'+this.carrier(b)] && items[b.id+':'+this.carrier(b)].type==='hung') { /* ок */ }
    let grounded=false;
    for(const b of blocks) for(const port of this.portList(b)){
      const x=items[b.id+':'+port]; if(x&&x.type==='fixed') grounded=true;
    }
    if(!grounded) prob.push('Система ни на чём не держится — прикрепите фиксатор (плоскость)');
    if(!prob.length){
      // связи могут противоречить друг другу: например, блок и подвешен на нити, и прибит фиксатором
      const r=this.solve(p);
      if(r.status==='bad')
        prob.push('Связи противоречат друг другу: какой-то блок закреплён и одновременно висит на нити. Уберите лишний фиксатор.');
      else if(r.status==='under')
        prob.push('Связей не хватает: часть системы может двигаться как угодно. Прикрепите ещё один конец.');
    }
    return {ok:prob.length===0, prob};
  },
  portName(b,port){
    if(b.kind==='fixed') return {top:'верх (к опоре)',l:'левый',r:'правый'}[port];
    return {l:'левый верхний',r:'правый верхний',bot:'низ (ось)'}[port];
  },

  /* ---- ИНСТРУМЕНТЫ (ПКМ-меню) ---- */
  ctxTools(p){
    const d=this.db(p), m=t=>(d.tool===t?'● ':'○ ');
    return [
      {label:m('fixblock')+'Неподвижный блок (на сетку или на крепление)', on:q=>{ SIMS.atwood.db(q).tool='fixblock'; }},
      {label:m('movblock')+'Подвижный блок (на сетку или на крепление)',   on:q=>{ SIMS.atwood.db(q).tool='movblock'; }},
      {label:m('mass')+`Груз ${p.mnew} кг`,                on:q=>{ SIMS.atwood.db(q).tool='mass'; }},
      {label:m('fixed')+'Опора (плоскость)',               on:q=>{ SIMS.atwood.db(q).tool='fixed'; }},
      {label:m('erase')+'Убрать элемент или блок',         on:q=>{ SIMS.atwood.db(q).tool='erase'; }},
      {label:'Очистить сетку',                            on:q=>{ q._atw=null; SIMS.atwood.db(q).blocks.length=0; }}
    ];
  },
  /* клик по сетке: ставим блок на свободное место или элемент на ближайший порт */
  clickAt(p,wx,wy){
    const d=this.db(p), tool=d.tool||'mass';

    if(tool==='fixblock'||tool==='movblock'){
      const kind = tool==='fixblock'?'fixed':'movable';
      /* Если рядом есть СВОБОДНОЕ крепление — подвешиваем новый блок прямо на него.
         Блок становится полноценным элементом: крепление родителя перестаёт быть
         пустым, а несущий порт нового блока занимает эта же нить. */
      const free=this.nearestPort(p,wx,wy,true);
      if(free){
        const id='P'+(d.seq++);
        const plan=this.attachPlan(free.b, free.port, kind);
        const nb={id, kind, x:plan.x, y:plan.y};
        d.blocks.push(nb);
        d.items[free.b.id+':'+free.port]={type:'block', blockId:id, childPort:plan.childPort};
        d.items[id+':'+plan.childPort]={type:'hung', parent:free.b.id+':'+free.port};
        d.warn=null;
        return;
      }
      // иначе — свободная установка в узел сетки
      const gx=Math.round(wx*2)/2, gy=Math.round(wy*2)/2;
      if(d.blocks.some(b=>Math.hypot(b.x-gx,b.y-gy)<0.9)) return;
      const id='P'+(d.seq++);
      d.blocks.push({id, kind, x:gx, y:gy});
      return;
    }

    // ластиком можно снять и элемент, и целый блок
    if(tool==='erase'){
      const hit=d.blocks.find(b=>Math.hypot(b.x-wx,b.y-wy)<0.5);
      if(hit){ this.removeBlock(p,hit.id); return; }
      const nr=this.nearestPort(p,wx,wy);
      if(nr) this.detach(p, nr.b.id+':'+nr.port);
      return;
    }

    const near=this.nearestPort(p,wx,wy);
    if(!near) return;
    const key=near.b.id+':'+near.port;
    const cur=d.items[key];
    if(cur && (cur.type==='block'||cur.type==='hung')) return;   // сначала снимите блок
    if(tool==='fixed'){ d.items[key]={type:'fixed'}; d.warn=null; return; }
    if(tool==='mass'){
      if(!this.allowsMass(near.b,near.port)){
        d.warn = near.b.kind==='fixed'
          ? 'На верхнее крепление неподвижного блока груз вешать нельзя — только опору или другой блок'
          : 'На верхние ветви подвижного блока груз вешать нельзя — они идут к опоре или к другому блоку. Груз цепляется снизу, к оси';
        return;
      }
      d.items[key]={type:'mass',m:p.mnew}; d.warn=null; return;
    }
  },
  /* снять элемент с крепления; если это связь блоков — разорвать её с обеих сторон */
  detach(p,key){
    const d=this.db(p), it=d.items[key];
    if(!it) return;
    if(it.type==='block'){
      const sub=it.blockId;
      for(const k of Object.keys(d.items))
        if(k.startsWith(sub+':') && d.items[k].type==='hung') delete d.items[k];
    } else if(it.type==='hung' && it.parent){
      delete d.items[it.parent];
    }
    delete d.items[key];
  },
  /* удалить блок вместе со всеми его связями */
  removeBlock(p,id){
    const d=this.db(p);
    for(const k of Object.keys(d.items)){
      const it=d.items[k];
      if(k.startsWith(id+':')){ this.detach(p,k); continue; }
      if(it && it.type==='block' && it.blockId===id) this.detach(p,k);
    }
    for(const k of Object.keys(d.items)) if(k.startsWith(id+':')) delete d.items[k];
    d.blocks=d.blocks.filter(b=>b.id!==id);
  },
  nearestPort(p,wx,wy,freeOnly){
    /* Крепления соседних блоков могут совпасть по координатам, поэтому ищем в два
       прохода: сначала среди СВОБОДНЫХ, и лишь если рядом таких нет — среди занятых.
       Так клик всегда попадает в то крепление, которое ещё можно заполнить. */
    const free=this.scanPorts(p,wx,wy,true);
    if(free || freeOnly) return free;
    return this.scanPorts(p,wx,wy,false);
  },
  scanPorts(p,wx,wy,freeOnly){
    const d=this.db(p); let best=null, bd=0.5;
    for(const b of d.blocks) for(const port of this.portList(b)){
      if(freeOnly && d.items[b.id+':'+port]) continue;
      const pos=this.portXY(b,port), dd=Math.hypot(pos.x-wx,pos.y-wy);
      if(dd<bd){ bd=dd; best={b,port,pos}; }
    }
    return best;
  },
  undoAction(p){
    const d=this.db(p);
    // убираем последний добавленный элемент, затем блоки
    const keys=Object.keys(d.items);
    if(keys.length>3){ delete d.items[keys[keys.length-1]]; return true; }  // не трогаем стартовые 3
    if(d.blocks.length>1){ const b=d.blocks.pop();
      for(const k of Object.keys(d.items)) if(k.startsWith(b.id+':')) delete d.items[k];
      return true; }
    return false;
  },

  init(p){ this.db(p); return {t:0, pos:{}, event:null, __stop:null}; },
  step(s,dt,p){
    s.t+=dt;
    if(!p.anim) return;
    const val=this.validate(p); if(!val.ok) return;
    const sol=this.solve(p); if(sol.status!=='ok') return;
    // интегрируем «смещения» грузов для мягкой анимации, ограничивая амплитуду
    const d=this.db(p);
    for(const b of d.blocks) for(const port of this.portList(b)){
      const it=d.items[b.id+':'+port]; if(!it||it.type!=='mass') continue;
      const key=b.id+':'+port;
      const a = (port==='bot') ? sol.vars['aax:'+b.id] : sol.vars['a:'+b.id+':'+port];
      if(!s.pos[key]) s.pos[key]={x:0,v:0};
      const st=s.pos[key];
      st.v += (a||0)*dt; st.x += st.v*dt;
      // ограничение: грузы не «улетают» — при достижении предела мягко тормозим и разворачиваем
      const LIM=1.1;
      if(st.x> LIM){ st.x= LIM; st.v=-Math.abs(st.v)*0.3; }
      if(st.x<-LIM){ st.x=-LIM; st.v= Math.abs(st.v)*0.3; }
    }
  },
  anchors(s,p){ const d=this.db(p); return d.blocks.map(b=>({x:b.x,y:b.y})); },
  readouts(s,p){
    const val=this.validate(p);
    const out=[['g',p.g,'м/с²']];
    const d=this.db(p);
    out.push(['блоков в системе',d.blocks.length,''],
      ['неподвижных',d.blocks.filter(b=>b.kind==='fixed').length,''],
      ['подвижных',d.blocks.filter(b=>b.kind==='movable').length,'']);
    if(!val.ok){
      out.push(['статус',0,'система собрана неверно']);
      val.prob.slice(0,4).forEach((t,i)=>out.push([`  → что исправить ${i+1}`,0,t]));
      return out;
    }
    const sol=this.solve(p);
    if(sol.status!=='ok'){ out.push(['статус',0,'не удаётся решить: проверьте связи']); return out; }
    out.push(['статус',0,'система собрана верно']);
    // перечисляем грузы с их ускорениями
    let idx=1;
    for(const b of d.blocks) for(const port of this.portList(b)){
      const it=d.items[b.id+':'+port]; if(!it||it.type!=='mass') continue;
      const a=(port==='bot')? sol.vars['aax:'+b.id] : sol.vars['a:'+b.id+':'+port];
      out.push([`груз ${idx} (${it.m} кг): ускорение`, a, 'м/с² ('+(a>0.01?'вниз':a<-0.01?'вверх':'покой')+')']);
      idx++;
    }
    if(p.tens){
      for(const b of d.blocks){
        out.push([`натяжение нити блока ${b.id}`, sol.vars['T:'+b.id], 'Н']);
        if(b.kind==='movable') out.push([`  нить снизу (ось) ${b.id}`, sol.vars['Tbot:'+b.id], 'Н (= 2T)']);
      }
    }
    return out;
  },
  presets:[
    {name:'Классическая машина Атвуда',values:{__preset:'classic',g:10,mnew:10}},
    {name:'Равные массы: равновесие',values:{__preset:'equal',g:10,mnew:15}},
    {name:'Подвижный блок: выигрыш в силе',values:{__preset:'movable',g:10,mnew:20}},
    {name:'Каскад: блок под блоком',values:{__preset:'cascade',g:10,mnew:10}},
    {name:'Пустая сетка — собрать самому',values:{__preset:'empty',g:10,mnew:10}}
  ],
  applyPreset(p,name){
    p._atw={blocks:[],items:{},seq:1,tool:'mass'};
    const d=p._atw;
    const F=(id,x,y)=>d.blocks.push({id,kind:'fixed',x,y});
    const M=(id,x,y)=>d.blocks.push({id,kind:'movable',x,y});
    if(name==='classic'){
      F('P1',0,1.6);
      d.items['P1:top']={type:'fixed'}; d.items['P1:l']={type:'mass',m:10}; d.items['P1:r']={type:'mass',m:20};
    } else if(name==='equal'){
      F('P1',0,1.6);
      d.items['P1:top']={type:'fixed'}; d.items['P1:l']={type:'mass',m:15}; d.items['P1:r']={type:'mass',m:15};
    } else if(name==='movable'){
      /* Канонический выигрыш в силе: нить идёт с неподвижного блока вниз,
         привязывается к левой точке подвижного, обходит его и уходит к опоре. */
      F('P1',0,2); M('M1',1,0);
      d.items['P1:top']={type:'fixed'};
      d.items['P1:l']={type:'mass',m:30};
      d.items['P1:r']={type:'block',blockId:'M1',childPort:'l'};
      d.items['M1:l']={type:'hung',parent:'P1:r'};
      d.items['M1:r']={type:'fixed'};
      d.items['M1:bot']={type:'mass',m:20};
    } else if(name==='cascade'){
      /* Верхний блок закреплён к потолку. Слева на нём груз, а справа за
         верхнее крепление подвешен ВТОРОЙ блок — у него своя нить и свои два груза.
         Ось второго блока свободна, поэтому он движется вместе с концом нити. */
      F('P1',0,2.5); F('P2',0.5,0.5);
      d.items['P1:top']={type:'fixed'};
      d.items['P1:l']={type:'mass',m:30};
      d.items['P1:r']={type:'block',blockId:'P2',childPort:'top'};
      d.items['P2:top']={type:'hung', parent:'P1:r'};
      d.items['P2:l']={type:'mass',m:10};
      d.items['P2:r']={type:'mass',m:20};
    } else {
      d.tool='fixblock';   // пустая сетка
    }
    d.seq=d.blocks.length+1;
  },
  fit(p,vp){
    const d=this.db(p);
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    let minx=-3,maxx=3,miny=-3,maxy=3;
    for(const b of d.blocks){ minx=Math.min(minx,b.x-1); maxx=Math.max(maxx,b.x+1);
      miny=Math.min(miny,b.y-2); maxy=Math.max(maxy,b.y+1); }
    const spanX=Math.max(maxx-minx,6), spanY=Math.max(maxy-miny,6);
    const scale=clamp(Math.min((W-60)/(spanX*PX_PER_M),(H-60)/(spanY*PX_PER_M)),0.002,30);
    return {x:(minx+maxx)/2, y:(miny+maxy)/2, scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'),
          ink=v.c('--ink-2'), ink3=v.c('--ink-3'), panel=v.c('--panel');
    const d=this.db(p), val=this.validate(p);
    const sol=val.ok?this.solve(p):null;
    const okSol = sol && sol.status==='ok';
    const R=0.5;                                  // радиус колеса
    /* Ось Y направлена ВВЕРХ: «выше» = больший y, груз висит в сторону минуса. */

    // подложка-сетка
    ctx.strokeStyle=ink3; ctx.globalAlpha=.08; ctx.lineWidth=v.lw(1);
    for(let gx=-7;gx<=7;gx+=0.5){ ctx.beginPath(); ctx.moveTo(gx,-6); ctx.lineTo(gx,6); ctx.stroke(); }
    for(let gy=-6;gy<=6;gy+=0.5){ ctx.beginPath(); ctx.moveTo(-7,gy); ctx.lineTo(7,gy); ctx.stroke(); }
    ctx.globalAlpha=1;

    const disp=(key)=> (p.anim && s.pos[key])? s.pos[key].x*0.28 : 0;
    const ropeX=(b,side)=> b.x + (side==='l'?-R:R);

    /* Рисуем то, что закреплено на конце нити.
       yEnd — точка конца нити, dir = +1 если элемент выше блока, −1 если ниже. */
    const drawItem=(px,yEnd,it,key,accelA,dir)=>{
      if(!it) return;
      if(it.type==='fixed'){
        // опорная площадка со штриховкой в сторону от блока
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.6);
        ctx.beginPath(); ctx.moveTo(px-0.5,yEnd); ctx.lineTo(px+0.5,yEnd); ctx.stroke();
        ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4);
        for(let i=0;i<6;i++){ const xx=px-0.45+i*0.18;
          ctx.beginPath(); ctx.moveTo(xx,yEnd); ctx.lineTo(xx-0.16,yEnd+dir*0.18); ctx.stroke(); }
        v.label(ctx,'опора',px,yEnd,-16,dir>0?-14:24,ink3);
      } else if(it.type==='mass'){
        // груз ВСЕГДА висит вниз от своей точки крепления
        const dy=disp(key);
        const cy=yEnd - 0.45 - dy;               // центр бруска ниже конца нити
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6);
        ctx.beginPath(); ctx.moveTo(px,yEnd); ctx.lineTo(px,cy+0.16); ctx.stroke();
        const w=0.36, h=0.30+0.05*Math.cbrt(it.m/10);
        ctx.fillStyle=acc; ctx.fillRect(px-w/2, cy-h/2, w, h);
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.4); ctx.strokeRect(px-w/2, cy-h/2, w, h);
        ctx.strokeStyle=panel; ctx.globalAlpha=.45; ctx.lineWidth=v.lw(1);
        ctx.beginPath(); ctx.moveTo(px-w/2+0.06,cy-h/2+0.06); ctx.lineTo(px-w/2+0.06,cy+h/2-0.06); ctx.stroke();
        ctx.globalAlpha=1;
        v.label(ctx,`${it.m} кг`,px,cy,-14,4,'#fff');
        if(p.accel && okSol && accelA!=null){
          if(Math.abs(accelA)>0.02){
            const L=clamp(Math.abs(accelA)*0.05,0.22,0.8)*Math.sign(accelA);
            // ускорение вниз положительно → стрелка вниз, значит по y в минус
            v.arrow(ctx, px+w/2+0.3, cy+L/2, px+w/2+0.3, cy-L/2, dang);
            v.label(ctx,`a = ${accelA.toFixed(2)} м/с²`,px+w/2+0.3,cy,10,4,dang);
          } else v.label(ctx,'a = 0',px+w/2+0.3,cy,10,4,ink3);
        }
      } else if(it.type==='block'||it.type==='hung'){
        v.label(ctx,'к блоку',px,yEnd,-18,dir>0?-12:20,ink3);
      }
    };

    for(const b of d.blocks){
      const isFix=b.kind==='fixed';
      const lx=ropeX(b,'l'), rx=ropeX(b,'r');
      // куда уходят концы нити: у неподвижного вниз, у подвижного вверх
      const dirEnds = isFix ? -1 : +1;
      const yEnds   = b.y + dirEnds*1;          // ровно клетка
      // несущий конец: у неподвижного вверх к опоре, у подвижного вниз к грузу
      const dirCar  = isFix ? +1 : -1;
      const yCar    = b.y + dirCar*1;

      // ── нить на ободе: полудуга со стороны, куда уходят концы ──
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.4);
      ctx.beginPath();
      if(isFix) ctx.arc(b.x,b.y,R, Math.PI, 0);        // верхняя половина обода
      else      ctx.arc(b.x,b.y,R, 0, Math.PI);        // нижняя половина обода
      ctx.stroke();

      // ── ветви нити к концам ──
      // у подвижного блока обе боковые линии показываем всегда: это его точки подвеса
      for(const side of ['l','r']){
        const px=ropeX(b,side), filled=!!d.items[b.id+':'+side];
        if(!filled && isFix) continue;
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(filled?1.7:1.1);
        ctx.globalAlpha=filled?1:.35;
        ctx.beginPath(); ctx.moveTo(px,b.y); ctx.lineTo(px,yEnds); ctx.stroke();
        ctx.globalAlpha=1;
        if(!filled && !isFix){        // отмечаем свободную точку подвеса
          ctx.fillStyle=meas; ctx.globalAlpha=.5;
          ctx.beginPath(); ctx.arc(px,yEnds,v.lw(2.4),0,7); ctx.fill(); ctx.globalAlpha=1;
        }
      }
      // ── несущая нить ──
      const carPort=this.carrier(b);
      if(d.items[b.id+':'+carPort]){
        ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.9);
        ctx.beginPath(); ctx.moveTo(b.x, b.y+dirCar*R); ctx.lineTo(b.x, yCar); ctx.stroke();
      }

      // ── колесо поверх нитей ──
      ctx.fillStyle=isFix?sec:meas; ctx.globalAlpha=.18;
      ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=isFix?sec:meas; ctx.lineWidth=v.lw(2.6);
      ctx.beginPath(); ctx.arc(b.x,b.y,R,0,7); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.arc(b.x,b.y,R*0.64,0,7); ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=ink; ctx.beginPath(); ctx.arc(b.x,b.y,v.lw(3),0,7); ctx.fill();

      // ── элементы на концах ──
      for(const side of ['l','r']){
        const it=d.items[b.id+':'+side]; if(!it) continue;
        const a=okSol? sol.vars['a:'+b.id+':'+side] : null;
        drawItem(ropeX(b,side), yEnds, it, b.id+':'+side, a, dirEnds);
      }
      {
        const it=d.items[b.id+':'+carPort];
        const a=(!isFix&&okSol)? sol.vars['aax:'+b.id] : null;
        drawItem(b.x, yCar, it, b.id+':'+carPort, a, dirCar);
      }

      // ── подписи ──
      v.label(ctx, isFix?'неподвижный':'подвижный', b.x, b.y, -28, isFix?-4:-4, isFix?sec:meas);
      if(p.tens && okSol){
        v.label(ctx,`T = ${sol.vars['T:'+b.id].toFixed(1)} Н`, b.x+R+0.12, b.y, 6, -8, ink3);
        if(!isFix) v.label(ctx,`нить снизу 2T = ${sol.vars['Tbot:'+b.id].toFixed(1)} Н`, b.x+R+0.12, b.y, 6, 8, ink3);
      }

      // мигающая подсветка свободных концов
      if(!val.ok){
        for(const port of this.portList(b)){
          if(!d.items[b.id+':'+port]){
            const pp=this.portXY(b,port);
            ctx.strokeStyle=dang; ctx.lineWidth=v.lw(2.2); ctx.globalAlpha=.45+0.4*Math.sin(s.t*5);
            ctx.beginPath(); ctx.arc(pp.x,pp.y,0.22,0,7); ctx.stroke(); ctx.globalAlpha=1;
            v.label(ctx,'?',pp.x,pp.y,-3,5,dang);
          }
        }
      }
    }

    // ── статус ──
    if(!d.blocks.length){
      v.label(ctx,'Пустая сетка',0,0.5,-32,0,ink);
      v.label(ctx,'ПКМ → выберите инструмент, затем щёлкните левой кнопкой по сетке',0,0,-190,0,ink3);
      v.label(ctx,'Начните с неподвижного или подвижного блока',0,-0.5,-130,0,ink3);
    } else if(!val.ok){
      v.label(ctx,'СИСТЕМА СОБРАНА НЕВЕРНО',-6.2,3.6,0,0,dang);
      val.prob.slice(0,3).forEach((t,i)=> v.label(ctx,'• '+t,-6.2,3.6,0,18+i*15,ink3));
      v.label(ctx,'красным мигают концы, которые нужно закрыть',-6.2,3.6,0,18+Math.min(val.prob.length,3)*15,dang);
    } else if(okSol){
      v.label(ctx,'Система собрана верно: ускорения и натяжения найдены',-6.2,3.6,0,0,acc);
    }
    if(d.warn){
      v.label(ctx,'✗ '+d.warn,-6.2,-3.5,0,0,dang);
    }
    v.label(ctx,'ПКМ — инструменты · ЛКМ по сетке — новый блок · ЛКМ по креплению — груз, опора или ещё один блок',-6.2,-4,0,0,ink3);
    if(d.blocks.length && !val.ok)
      v.label(ctx,'блок, поставленный на свободное крепление, подвешивается к нему и закрывает его',-6.2,-4,0,16,ink3);
  }
}
});
