'use strict';
/* ===================== ФИЗИКА ЗВУКА: КОНСТРУКТОР ИНСТРУМЕНТА =====================
   Здесь звук не «проигрывается из файла», а СОБИРАЕТСЯ из физики, и каждый
   ползунок отвечает за настоящую величину.

   1. ВЫСОТА. Звук — колебания давления. Частота колебаний f и есть высота
      тона; длина волны λ = v/f, где v = 343 м/с — скорость звука в воздухе.
      Соседние клавиши отличаются в 2^(1/12) раз, октава — ровно вдвое.

   2. ТЕМБР — это набор ГАРМОНИК. Любое периодическое колебание раскладывается
      в сумму синусов кратных частот (ряд Фурье):
          y(t) = Σ aₖ·sin(2πk f t).
      Один синус звучит пусто; добавьте гармоники с амплитудами aₖ = 1/k — и
      получится пила, как у скрипки; только нечётные — меандр, как у кларнета.
      Ползунки «число гармоник» и «спад» строят ряд прямо на глазах, а сцена
      показывает и получившуюся форму волны, и её спектр.

   3. ГРОМКОСТЬ ВО ВРЕМЕНИ — огибающая. У рояля звук возникает мгновенно и
      затухает (энергия уходит в деку и воздух), у органа держится, пока дуют.
      Четыре числа: время нарастания, время спада, уровень удержания и время
      затухания после отпускания.

   4. ГЛУХОЙ ИЛИ ЗВОНКИЙ — это фильтр. Мягкие материалы поглощают высокие
      гармоники сильнее низких, поэтому звук за стеной глухой. Частота среза
      фильтра ровно это и делает.

   5. ЭХО И ГУЛ ПОМЕЩЕНИЯ. Звук отражается от стен: до дальней стены и обратно
      он идёт время 2L/v — это и есть задержка эха. А общий гул описывается
      формулой Сабина:  T₆₀ = 0,161·V/(S·α),  где V — объём, S — площадь стен,
      α — коэффициент поглощения. Для куба со стороной L это T₆₀ = 0,161·L/(6α).

   Играть можно клавишами компьютера (ряды «zsxdcvgbhnjm» и «q2w3er5t6y7u»)
   или прямо по нарисованной клавиатуре — мышью или пальцем.                 */

/* ---------------------------------------------------------------------------
   Звуковой движок. Живёт одной копией на всё приложение: браузер разрешает
   создавать AudioContext только после жеста пользователя, поэтому создаём его
   лениво — при первом нажатии клавиши.                                       */
const SND={
  ctx:null, master:null, filt:null, dry:null, wet:null, dly:null, fb:null,
  voices:new Map(), wave:null, waveKey:'',
  /* Коэффициенты ряда Фурье. Одни и те же числа идут и в звук, и в рисунок,
     поэтому картинка всегда показывает ровно то, что слышно. */
  coefs(p){
    const n=clamp(Math.round(p.nHarm||1),1,32), d=+p.hDecay||1, out=[];
    for(let k=1;k<=n;k++){
      let a=0;
      switch(p.wave){
        case 'sine':  a = k===1?1:0; break;
        case 'saw':   a = 1/k; break;                       // все гармоники, 1/k
        case 'square':a = (k%2)?1/k:0; break;               // только нечётные
        case 'tri':   a = (k%2)?((k%4===1?1:-1)/(k*k)):0; break;
        default:      a = (p.odd&&k%2===0)?0:1/Math.pow(k,d);
      }
      out.push(a);
    }
    const mx=Math.max(...out.map(Math.abs),1e-9);
    return out.map(a=>a/mx);                                // нормируем к единице
  },
  ensure(){
    if(this.ctx) { if(this.ctx.state==='suspended') this.ctx.resume(); return true; }
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) return false;
    try{ this.ctx=new AC(); }catch(_){ return false; }
    const c=this.ctx;
    this.master=c.createGain(); this.master.gain.value=0.25;
    this.filt=c.createBiquadFilter(); this.filt.type='lowpass';
    this.dly=c.createDelay(2.0);
    this.fb=c.createGain();
    this.dry=c.createGain(); this.wet=c.createGain();
    // сухой сигнал идёт прямо, влажный — через задержку с обратной связью
    this.filt.connect(this.dry).connect(this.master);
    this.filt.connect(this.dly);
    this.dly.connect(this.fb).connect(this.dly);            // повторные отражения
    this.dly.connect(this.wet).connect(this.master);
    this.master.connect(c.destination);
    return true;
  },
  /* Параметры комнаты и фильтра пересчитываются из физики, а не «на глаз». */
  apply(p){
    if(!this.ctx) return;
    const t=this.ctx.currentTime;
    this.master.gain.setTargetAtTime(clamp(+p.vol||0,0,1)*0.5,t,0.02);
    this.filt.frequency.setTargetAtTime(clamp(+p.cutoff||8000,60,18000),t,0.02);
    this.filt.Q.setTargetAtTime(clamp(+p.q||0.7,0.1,20),t,0.02);
    const dl=clamp(2*(+p.roomL||0)/343,0.001,2);            // 2L/v — путь до стены и обратно
    this.dly.delayTime.setTargetAtTime(dl,t,0.05);
    this.fb.gain.setTargetAtTime(clamp(1-(+p.absorb||0.3),0,0.92),t,0.05);
    const w=clamp(+p.wet||0,0,1);
    this.wet.gain.setTargetAtTime(w,t,0.05);
    this.dry.gain.setTargetAtTime(1-w*0.4,t,0.05);
  },
  periodic(p){
    const key=[p.wave,p.nHarm,p.hDecay,p.odd].join('|');
    if(this.wave&&this.waveKey===key) return this.wave;
    const a=this.coefs(p), n=a.length;
    const real=new Float32Array(n+1), imag=new Float32Array(n+1);
    for(let k=1;k<=n;k++) imag[k]=a[k-1];
    this.wave=this.ctx.createPeriodicWave(real,imag,{disableNormalization:false});
    this.waveKey=key;
    return this.wave;
  },
  noteOn(id,f,p){
    if(!this.ensure()) return;
    if(this.voices.has(id)) return;                          // уже звучит
    this.apply(p);
    const c=this.ctx, t=c.currentTime;
    const osc=c.createOscillator(), vca=c.createGain();
    osc.setPeriodicWave(this.periodic(p));
    osc.frequency.setValueAtTime(f,t);
    /* Огибающая: нарастание — спад — удержание. Всё в секундах, как в
       настоящем синтезаторе, и ровно это рисуется на сцене. */
    const A=Math.max(0.001,(+p.attack||10)/1000);
    const D=Math.max(0.001,(+p.decayT||120)/1000);
    const S=clamp(+p.sustain,0,1);
    vca.gain.setValueAtTime(0.0001,t);
    vca.gain.exponentialRampToValueAtTime(1,t+A);
    vca.gain.exponentialRampToValueAtTime(Math.max(S,0.0001),t+A+D);
    osc.connect(vca).connect(this.filt);
    osc.start(t);
    this.voices.set(id,{osc,vca,f});
  },
  noteOff(id,p){
    const v=this.voices.get(id); if(!v) return;
    this.voices.delete(id);
    const c=this.ctx, t=c.currentTime;
    const R=Math.max(0.005,(+p.release||300)/1000);
    try{
      v.vca.gain.cancelScheduledValues(t);
      v.vca.gain.setValueAtTime(Math.max(v.vca.gain.value,0.0001),t);
      v.vca.gain.exponentialRampToValueAtTime(0.0001,t+R);
      v.osc.stop(t+R+0.05);
    }catch(_){}
  },
  allOff(p){ for(const id of [...this.voices.keys()]) this.noteOff(id,p||{release:80}); },
  active(){ return [...this.voices.values()].map(v=>v.f); }
};

Object.assign(SIMS,{
synth:{
  title:'Конструктор звука: собери музыкальный инструмент',
  V:343,                                     // скорость звука в воздухе, м/с
  A4:440,
  /* Названия полутонов от до; чёрные клавиши помечены. */
  NOTES:['до','до♯','ре','ре♯','ми','фа','фа♯','соль','соль♯','ля','ля♯','си'],
  BLACK:[false,true,false,true,false,false,true,false,true,false,true,false],
  /* Раскладка компьютерной клавиатуры: два ряда — две октавы, как в трекерах. */
  KEYMAP:{
    KeyZ:0,KeyS:1,KeyX:2,KeyD:3,KeyC:4,KeyV:5,KeyG:6,KeyB:7,KeyH:8,KeyN:9,KeyJ:10,KeyM:11,
    Comma:12,KeyL:13,Period:14,Semicolon:15,Slash:16,
    KeyQ:12,Digit2:13,KeyW:14,Digit3:15,KeyE:16,KeyR:17,Digit5:18,KeyT:19,Digit6:20,
    KeyY:21,Digit7:22,KeyU:23
  },
  params:[
    {key:'instr',label:'Готовый инструмент',type:'select',default:'piano',
     options:[{v:'piano', t:'Пианино: щелчок и затухание'},
              {v:'organ', t:'Орган: тянется, пока держишь'},
              {v:'drum',  t:'Барабан: короткий глухой удар'},
              {v:'bell',  t:'Колокол: долгий звон в зале'},
              {v:'flute', t:'Флейта: почти чистый тон'},
              {v:'bass',  t:'Бас: низко и глухо'}]},

    {type:'group',label:'Высота'},
    {key:'octave',label:'Сдвиг октав',min:-3,max:3,step:1,default:0},

    {type:'group',label:'Тембр: гармоники (ряд Фурье)'},
    {key:'wave',  label:'Форма колебания',type:'select',default:'custom',
     options:[{v:'sine',t:'Чистый синус — одна гармоника'},
              {v:'saw', t:'Пила — все гармоники 1/k'},
              {v:'square',t:'Меандр — только нечётные'},
              {v:'tri', t:'Треугольник — нечётные, 1/k²'},
              {v:'custom',t:'Своя: собрать вручную'}]},
    {key:'nHarm', label:'Сколько гармоник складываем',min:1,max:32,step:1,default:8},
    {key:'hDecay',label:'Спад амплитуд: aₖ = 1/k^d',min:0.3,max:3,step:0.1,default:1},
    {key:'odd',   label:'Только нечётные гармоники',type:'check',default:false},

    {type:'group',label:'Громкость во времени (огибающая)'},
    {key:'attack', label:'Нарастание',unit:'мс',min:1,max:800,step:1,default:6},
    {key:'decayT', label:'Спад до удержания',unit:'мс',min:5,max:2000,step:5,default:300},
    {key:'sustain',label:'Уровень удержания',min:0,max:1,step:0.01,default:0.25},
    {key:'release',label:'Затухание после отпускания',unit:'мс',min:10,max:3000,step:10,default:500},

    {type:'group',label:'Глухой или звонкий (фильтр)'},
    {key:'cutoff',label:'Частота среза',unit:'Гц',min:120,max:16000,step:10,default:6000},
    {key:'q',     label:'Добротность фильтра Q',min:0.3,max:16,step:0.1,default:0.8},

    {type:'group',label:'Помещение: эхо и гул'},
    {key:'roomL', label:'Размер комнаты L',unit:'м',min:0.5,max:40,step:0.5,default:6},
    {key:'absorb',label:'Поглощение стен α',min:0.05,max:0.95,step:0.01,default:0.35},
    {key:'wet',   label:'Доля отражённого звука',min:0,max:1,step:0.01,default:0.25},

    {type:'group',label:'Общее'},
    {key:'vol',   label:'Громкость',min:0,max:1,step:0.01,default:0.5},
    {key:'keys',  label:'Клавиатура на сцене',type:'check',default:true},
    {key:'spec',  label:'Спектр гармоник',type:'check',default:true},
    {key:'env',   label:'Огибающая',type:'check',default:true},
    {key:'room',  label:'Схема помещения',type:'check',default:true}
  ],
  /* Готовые инструменты — это просто наборы тех же физических параметров. */
  INSTR:{
    piano:{wave:'custom',nHarm:12,hDecay:1.4,odd:false,attack:4,decayT:420,sustain:0.18,release:600,
           cutoff:5200,q:0.8,roomL:6,absorb:0.35,wet:0.22},
    organ:{wave:'custom',nHarm:9,hDecay:0.9,odd:true,attack:35,decayT:60,sustain:0.95,release:180,
           cutoff:7000,q:0.7,roomL:18,absorb:0.12,wet:0.5},
    drum: {wave:'custom',nHarm:20,hDecay:0.6,odd:false,attack:2,decayT:110,sustain:0.0,release:90,
           cutoff:900,q:2.5,roomL:4,absorb:0.6,wet:0.12},
    bell: {wave:'custom',nHarm:16,hDecay:0.8,odd:true,attack:3,decayT:1500,sustain:0.12,release:2400,
           cutoff:12000,q:1.2,roomL:26,absorb:0.08,wet:0.6},
    flute:{wave:'sine',nHarm:3,hDecay:2.4,odd:false,attack:70,decayT:120,sustain:0.85,release:220,
           cutoff:4000,q:0.7,roomL:8,absorb:0.4,wet:0.2},
    bass: {wave:'custom',nHarm:6,hDecay:1.8,odd:false,attack:8,decayT:260,sustain:0.5,release:260,
           cutoff:600,q:1.0,roomL:5,absorb:0.5,wet:0.1}
  },
  /* Частота полутона n от до первой октавы: f = 440·2^((n−9)/12). */
  freq(p,n){ return this.A4*Math.pow(2,(n-9)/12+ (+p.octave||0)); },
  lambda(f){ return this.V/Math.max(f,1e-9); },
  /* Формула Сабина для куба со стороной L: V = L³, S = 6L². */
  rt60(p){
    const L=Math.max(+p.roomL||0.5,0.1), al=clamp(+p.absorb||0.3,0.01,0.99);
    return 0.161*L/(6*al);
  },
  echoDelay(p){ return 2*(+p.roomL||0)/this.V; },

  /* --------- геометрия нарисованной клавиатуры --------- */
  KX:-8.4, KY:-3.1, KW:16.8, KH:2.2, OCT:2,
  whiteCount(){ return 7*this.OCT; },
  keyRect(n){                                  // n — номер полутона от 0
    const oct=Math.floor(n/12), s=n%12;
    const WH=[0,2,4,5,7,9,11].indexOf(s);
    const ww=this.KW/this.whiteCount();
    if(WH>=0){                                 // белая клавиша
      const idx=oct*7+WH;
      return {x:this.KX+idx*ww, w:ww, y:this.KY, h:this.KH, black:false};
    }
    const below=[0,0,2,2,4,5,5,7,7,9,9,11][s]; // ближайшая белая слева
    const idx=oct*7+[0,2,4,5,7,9,11].indexOf(below);
    return {x:this.KX+(idx+0.68)*ww, w:ww*0.64, y:this.KY+this.KH*0.40,
            h:this.KH*0.60, black:true};
  },
  keyAt(x,y){
    for(let n=0;n<12*this.OCT;n++){            // чёрные проверяем первыми — они сверху
      const r=this.keyRect(n); if(!r.black) continue;
      if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return n;
    }
    for(let n=0;n<12*this.OCT;n++){
      const r=this.keyRect(n); if(r.black) continue;
      if(x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return n;
    }
    return -1;
  },

  init(p){
    Object.assign(p,this.INSTR[p.instr]||{});
    return {t:0,instr:p.instr,down:{},last:null,event:null,__stop:null};
  },
  step(s,dt,p){
    s.t+=dt;
    // смена готового инструмента подставляет весь набор параметров разом
    if(s.instr!==p.instr){ s.instr=p.instr; Object.assign(p,this.INSTR[p.instr]||{}); }
    SND.apply(p);
  },
  /* --------- игра мышью и пальцем прямо по сцене --------- */
  pressAt(p,x,y,s){
    const n=this.keyAt(x,y); if(n<0) return;
    const f=this.freq(p,n);
    SND.noteOn('m',f,p);
    if(s){ s.down['m']=n; s.last={n,f}; }
  },
  releaseAt(p,s){ SND.noteOff('m',p); if(s) delete s.down['m']; },

  anchors(s,p){ return [{x:0,y:0}]; },
  readouts(s,p){
    const on=SND.active();
    const f=s.last?s.last.f:this.freq(p,9);      // по умолчанию показываем ля
    const co=SND.coefs(p);
    const nH=co.filter(a=>Math.abs(a)>1e-6).length;
    const out=[['t',s.t,'с'],
      ['звучит нот',on.length,''],
      ['последняя нота',NaN,s.last?`${this.NOTES[s.last.n%12]} ${4+Math.floor(s.last.n/12)+(+p.octave||0)}`:'—'],
      ['её частота f',f,'Гц'],
      ['период T = 1/f',1000/f,'мс'],
      ['длина волны λ = v/f',this.lambda(f),'м'],
      ['скорость звука v',this.V,'м/с'],
      ['соседний полутон — во сколько раз',Math.pow(2,1/12),''],
      ['— тембр —',NaN,'ряд Фурье'],
      ['гармоник в сумме',nH,''],
      ['частота 2-й гармоники',2*f,'Гц'],
      ['частота высшей гармоники',co.length*f,'Гц'],
      ['— помещение —',NaN,'эхо и гул'],
      ['путь до стены и обратно 2L',2*p.roomL,'м'],
      ['задержка эха 2L/v',this.echoDelay(p)*1000,'мс'],
      ['время реверберации T₆₀ (Сабин)',this.rt60(p),'с'],
      ['частота среза фильтра',p.cutoff,'Гц'],
      ['гармоник ниже среза',co.filter((a,i)=>(i+1)*f<=p.cutoff&&Math.abs(a)>1e-6).length,'']];
    if(on.length===2) out.push(['биения |f₁ − f₂|',Math.abs(on[0]-on[1]),'Гц']);
    return out;
  },
  graphs:[
    {label:'Частота последней ноты',unit:'Гц',series:['f'],
     get(s,p){ return [s.last?s.last.f:null,null]; }},
    {label:'Звучит нот',unit:'шт',series:['n'],get(s,p){ return [SND.voices.size,null]; }}
  ],
  presets:[
    {name:'Пианино',values:{instr:'piano'}},
    {name:'Орган в соборе',values:{instr:'organ'}},
    {name:'Барабан',values:{instr:'drum'}},
    {name:'Колокол',values:{instr:'bell'}},
    {name:'Флейта: один синус',values:{instr:'flute'}},
    {name:'Бас',values:{instr:'bass'}}
  ],
  ctxTools(p){
    return [
      {label:'Сыграть гамму до-мажор', on:q=>SIMS.synth.playScale(q)},
      {label:'Взять аккорд до-мажор',  on:q=>SIMS.synth.playChord(q,[0,4,7])},
      {label:'Взять минорный аккорд',  on:q=>SIMS.synth.playChord(q,[0,3,7])},
      {label:'Две близкие ноты: услышать биения', on:q=>SIMS.synth.playBeat(q)},
      {label:'Тишина: оборвать все ноты', on:q=>SND.allOff(q)}
    ];
  },
  playScale(p){
    const seq=[0,2,4,5,7,9,11,12];
    seq.forEach((n,i)=>setTimeout(()=>{
      SND.noteOn('s'+i,this.freq(p,n),p);
      setTimeout(()=>SND.noteOff('s'+i,p),260);
    },i*300));
  },
  playChord(p,ns){
    ns.forEach((n,i)=>SND.noteOn('c'+i,this.freq(p,n),p));
    setTimeout(()=>ns.forEach((n,i)=>SND.noteOff('c'+i,p)),1200);
  },
  playBeat(p){
    /* Две почти одинаковые частоты дают биения с частотой |f₁ − f₂|:
       слышно, как громкость пульсирует несколько раз в секунду. */
    const f=this.freq(p,9);
    SND.noteOn('b1',f,p); SND.noteOn('b2',f*Math.pow(2,4/1200),p);
    setTimeout(()=>{ SND.noteOff('b1',p); SND.noteOff('b2',p); },2600);
  },
  fit(p,vp){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    const scale=clamp(Math.min((W-50)/(18.4*PX_PER_M),(H-50)/(13.6*PX_PER_M)),0.002,30);
    return {x:0,y:1.5,scale};
  },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), sec=v.c('--second'), meas=v.c('--measure'),
          dang=v.c('--danger'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), ok=v.c('--ok');
    const mid=t=>-Math.round(String(t).length*3.05);
    const co=SND.coefs(p);

    // ---------- форма колебания: сумма гармоник ----------
    {
      const gx=-8.4, gy=4.6, gw=7.9, gh=1.4;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(2);
      ctx.beginPath();
      const N=260;
      for(let i=0;i<=N;i++){
        const u=i/N*2;                                  // два периода
        let y=0;
        for(let k=1;k<=co.length;k++) y+=co[k-1]*Math.sin(2*Math.PI*k*u);
        i?ctx.lineTo(gx+gw*i/N,gy+gh*0.46*y):ctx.moveTo(gx+gw*i/N,gy+gh*0.46*y);
      }
      ctx.stroke();
      v.label(ctx,'форма колебания: y = Σ aₖ·sin(2πk f t)',gx,gy+gh*0.55,2,-8,ink3);
      v.label(ctx,'два периода',gx+gw,gy-gh*0.55,-74,12,ink3);
    }

    // ---------- спектр гармоник ----------
    if(p.spec){
      const gx=0.6, gy=3.6, gw=7.8, gh=1.8;
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      const n=co.length, bw=gw/Math.max(n,1);
      const f0=s.last?s.last.f:this.freq(p,9);
      for(let k=1;k<=n;k++){
        const a=Math.abs(co[k-1]); if(a<1e-6) continue;
        // гармоники выше среза фильтр приглушает — красим их иначе
        const cut=(k*f0)>p.cutoff;
        ctx.fillStyle=cut?ink3:acc; ctx.globalAlpha=cut?.35:.85;
        ctx.fillRect(gx+(k-1)*bw, gy, bw*0.72, gh*a);
      }
      ctx.globalAlpha=1;
      // длинную строку кадр отжимал влево, на соседний блок — держим короткой
      v.label(ctx,'спектр гармоник · серые — выше среза',gx,gy+gh,2,-8,ink3);
      v.label(ctx,`гармоники 1…${n}`,gx,gy,2,14,ink3);

    }

    // ---------- огибающая ----------
    if(p.env){
      const gx=-8.4, gy=0.9, gw=7.9, gh=1.4;
      const A=+p.attack||1, D=+p.decayT||1, R=+p.release||1, S=clamp(+p.sustain,0,1);
      const hold=Math.max(A+D,300);
      const tot=A+D+hold+R;
      const X=ms=>gx+gw*clamp(ms/tot,0,1), Y=g=>gy+gh*clamp(g,0,1);
      ctx.strokeStyle=ink3; ctx.globalAlpha=.5; ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(gx,gy); ctx.lineTo(gx+gw,gy); ctx.stroke(); ctx.globalAlpha=1;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(2.2);
      ctx.beginPath();
      ctx.moveTo(X(0),Y(0));
      ctx.lineTo(X(A),Y(1));
      ctx.lineTo(X(A+D),Y(S));
      ctx.lineTo(X(A+D+hold),Y(S));
      ctx.lineTo(X(tot),Y(0));
      ctx.stroke();
      // момент отпускания клавиши
      ctx.strokeStyle=ink3; ctx.setLineDash([v.lw(3),v.lw(3)]); ctx.lineWidth=v.lw(1);
      ctx.beginPath(); ctx.moveTo(X(A+D+hold),gy); ctx.lineTo(X(A+D+hold),gy+gh); ctx.stroke();
      ctx.setLineDash([]);
      v.label(ctx,'громкость во времени',gx,gy+gh,2,-8,ink3);
      v.label(ctx,`${A} мс`,X(A/2),gy,-16,14,ink3);
      v.label(ctx,'отпустили',X(A+D+hold),gy+gh,-28,-6,ink3);
      v.label(ctx,`${R} мс`,X(A+D+hold+R/2),gy,-16,14,ink3);
    }

    // ---------- помещение: эхо и гул ----------
    if(p.room){
      const gx=0.6, gy=0.8, gw=7.8, gh=1.8;
      const L=Math.max(+p.roomL||0.5,0.5);
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.8);
      ctx.strokeRect(gx,gy,gw,gh);
      // источник слева, слушатель справа, луч отражается от дальней стены
      const sx=gx+gw*0.16, sy=gy+gh*0.5, lx=gx+gw*0.42;
      ctx.fillStyle=dang; ctx.beginPath(); ctx.arc(sx,sy,v.lw(4),0,7); ctx.fill();
      ctx.fillStyle=acc;  ctx.beginPath(); ctx.arc(lx,sy,v.lw(4),0,7); ctx.fill();
      ctx.strokeStyle=dang; ctx.globalAlpha=.8; ctx.lineWidth=v.lw(1.4);
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(lx,sy); ctx.stroke();     // прямой звук
      ctx.strokeStyle=sec; ctx.setLineDash([v.lw(4),v.lw(3)]);
      ctx.beginPath();
      ctx.moveTo(sx,sy); ctx.lineTo(gx+gw-0.1,gy+gh*0.78); ctx.lineTo(lx,sy);  // отражённый
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
      v.label(ctx,'источник',sx,sy,-24,-13,dang);
      v.label(ctx,'слушатель',lx,sy,-28,16,acc);
      v.label(ctx,`комната L = ${L} м`,gx,gy+gh,4,-8,ink3);
      v.label(ctx,`эхо приходит через 2L/v = ${(this.echoDelay(p)*1000).toFixed(0)} мс`,
        gx,gy,4,15,sec);
      v.label(ctx,`гул затухает за T₆₀ = 0,161·L/(6α) = ${this.rt60(p).toFixed(2)} с`,
        gx,gy,4,29,ink3);
    }

    // ---------- клавиатура ----------
    if(p.keys){
      const on=new Set(Object.values(s.down||{}));
      // сначала белые
      for(let n=0;n<12*this.OCT;n++){
        const r=this.keyRect(n); if(r.black) continue;
        const hot=on.has(n);
        ctx.fillStyle=hot?v.c('--accent-soft'):v.c('--panel');
        ctx.strokeStyle=hot?acc:ink; ctx.lineWidth=v.lw(1.4);
        ctx.beginPath(); ctx.rect(r.x+0.02,r.y,r.w-0.04,r.h); ctx.fill(); ctx.stroke();
      }
      for(let n=0;n<12*this.OCT;n++){
        const r=this.keyRect(n); if(!r.black) continue;
        const hot=on.has(n);
        ctx.fillStyle=hot?acc:v.c('--ink');
        ctx.beginPath(); ctx.rect(r.x,r.y,r.w,r.h); ctx.fill();
      }
      // подписи нот и букв компьютерной клавиатуры на белых клавишах
      /* Подписи букв: коды вроде Comma и Semicolon превращаем в сами знаки,
         а для верхней октавы предпочитаем буквенный ряд q…u — он нагляднее
         запятых с точками. */
      const NICE={Comma:',',Period:'.',Slash:'/',Semicolon:';'};
      const PREF=['KeyQ','Digit2','KeyW','Digit3','KeyE','KeyR','Digit5','KeyT','Digit6','KeyY','Digit7','KeyU'];
      const inv={};
      for(const code of Object.keys(this.KEYMAP)){
        const nn=this.KEYMAP[code];
        const lbl=NICE[code]||code.replace(/^(Key|Digit)/,'').toLowerCase();
        if(inv[nn]===undefined||PREF.includes(code)) inv[nn]=lbl;
      }
      for(let n=0;n<12*this.OCT;n++){
        const r=this.keyRect(n); if(r.black) continue;
        const nm=this.NOTES[n%12];
        v.label(ctx,nm,r.x+r.w/2,r.y,-Math.round(nm.length*3.05),-9,ink3);
        if(inv[n]) v.label(ctx,inv[n],r.x+r.w/2,r.y,-3,-23,acc);
      }
      const hint='играйте мышью или пальцем по клавишам, либо буквами на компьютере';
      v.label(ctx,hint,0,this.KY,mid(hint),16,ink3);
    }

    // ---------- что звучит сейчас ----------
    const act=SND.active();
    if(act.length){
      const t=`звучит: ${act.map(f=>f.toFixed(1)+' Гц').join(' · ')}`;
      v.label(ctx,t,0,6.5,mid(t),0,ok);
      if(act.length===2){
        const b=Math.abs(act[0]-act[1]);
        const t2=`две частоты рядом → биения ${b.toFixed(1)} раз в секунду`;
        v.label(ctx,t2,0,6.5,mid(t2),14,meas);
      }
    } else {
      const t=SND.ctx?'нажмите клавишу — соберётся звук из гармоник':'нажмите клавишу, чтобы включить звук';
      v.label(ctx,t,0,6.5,mid(t),0,ink3);
    }
  }
}
});

/* ---------------------------------------------------------------------------
   Игра с компьютерной клавиатуры. Слушаем в фазе перехвата и гасим событие:
   иначе буквы нот («v», «p», «r», «m» и другие) заодно переключали бы
   инструменты сцены и сбрасывали симуляцию.                                  */
(function(){
  const isTyping=e=>e.target&&e.target.closest&&e.target.closest('input,textarea,select,[contenteditable]');
  const activeSynth=()=>typeof S!=='undefined'&&S&&S.active==='synth'&&typeof RT!=='undefined'&&RT.synth;
  addEventListener('keydown',e=>{
    if(!activeSynth()||isTyping(e)||e.ctrlKey||e.metaKey||e.altKey) return;
    const n=SIMS.synth.KEYMAP[e.code];
    if(n===undefined) return;
    e.preventDefault(); e.stopPropagation();
    if(e.repeat) return;
    const a=RT.synth;
    SND.noteOn('k'+e.code,SIMS.synth.freq(a.params,n),a.params);
    if(a.state){ a.state.down['k'+e.code]=n; a.state.last={n,f:SIMS.synth.freq(a.params,n)}; }
  },true);
  addEventListener('keyup',e=>{
    if(!activeSynth()) return;
    const n=SIMS.synth.KEYMAP[e.code];
    if(n===undefined) return;
    e.preventDefault(); e.stopPropagation();
    const a=RT.synth;
    SND.noteOff('k'+e.code,a.params);
    if(a.state) delete a.state.down['k'+e.code];
  },true);
  // ушли со сцены или свернули вкладку — звук не должен тянуться
  addEventListener('blur',()=>SND.allOff({release:60}));
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) SND.allOff({release:60}); });
})();
