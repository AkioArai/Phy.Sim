/* ===================== ПЕСОЧНИЦА САМОДЕЛЬНЫХ СИМУЛЯЦИЙ (10.0.0) =====================
   Человек описывает сцену словами, ИИ пишет код по нашей инструкции, код
   вставляется в Мастерскую — и получается симуляция с параметрами,
   показаниями, графиками, ручками и зондом, как у встроенных.

   Чужой код нельзя выполнять в странице: у неё прогресс, заметки, настройки,
   а в приложении для Android — ещё и мост для сохранения файлов. Поэтому
   модель живёт в отдельном потоке (Web Worker), созданном из data:-адреса.
   У такого потока «непрозрачное» происхождение: ни localStorage, ни
   IndexedDB, ни кэша, ни DOM, ни моста — только сообщения. Сеть в нём
   дополнительно выключена. Повис — поток просто убивается по таймеру.

   Рисует модель не на холсте, а СПИСКОМ КОМАНД: «линия», «шар», «пружина»,
   «жидкость», «стрелка силы». Список исполняет страница — своими функциями
   и цветами темы. Отсюда строгий вид без усилий автора: градиент нарисовать
   просто нечем, а цвет задаётся именем («accent», «danger») и сам
   подстраивается под светлую и тёмную тему. Любой другой цвет («#ff0000»,
   «red») заменяется ближайшим цветом палитры.

   Хозяин держит «теневое» определение в SIMS: init/step/draw/readouts
   отвечают сразу, из последнего присланного кадра, а поток догоняет.
   Отставание — один кадр, его не видно.                                     */

const ФОРМАТ_САМОДЕЛЬНЫХ=1;

/* ---------- 1. Код потока. На странице НЕ вызывается: его текст уходит в data:-адрес ---------- */
function песочницаПотока(){
  'use strict';
  const послать=self.postMessage.bind(self);
  const строкКода=self.__строк|0, код=self.__код;
  /* сеть и прочие выходы наружу — выключены; хранилищ у data:-потока и так нет */
  for(const имя of ['fetch','XMLHttpRequest','WebSocket','EventSource','importScripts','Worker','SharedWorker',
                    'BroadcastChannel','WebTransport','RTCPeerConnection','indexedDB','caches']){
    for(const o of [self, self.WorkerGlobalScope&&WorkerGlobalScope.prototype, self.DedicatedWorkerGlobalScope&&DedicatedWorkerGlobalScope.prototype]){
      if(!o) continue; try{ delete o[имя]; }catch(_){}
      try{ Object.defineProperty(o,имя,{value:undefined,writable:false,configurable:false}); }catch(_){} } }

  /* ---- помощники для автора модели (описаны в инструкции) ---- */
  const помощь={
    clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),
    lerp:(a,b,k)=>a+(b-a)*k,
    deg:Math.PI/180, g:9.81,
    /* шаг Рунге — Кутты 4-го порядка: f(t, y) → dy/dt, y — массив чисел */
    rk4(f,y,t,dt){
      const ад=(a,b,k)=>a.map((v,i)=>v+b[i]*k);
      const k1=f(t,y), k2=f(t+dt/2,ад(y,k1,dt/2)), k3=f(t+dt/2,ад(y,k2,dt/2)), k4=f(t+dt,ад(y,k3,dt));
      return y.map((v,i)=>v+dt*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);
    },
    /* воспроизводимый случайный генератор: seeded(42)() → число в [0, 1) */
    seeded(seed){ let x=(seed>>>0)||1; return ()=>{ x^=x<<13; x>>>=0; x^=x>>>17; x^=x<<5; x>>>=0; return x/4294967296; }; }
  };
  Object.assign(self,помощь);
  let ОПР=null, вызовов=0;
  self.simulation=self.симуляция=self.sim=function(d){ вызовов++; ОПР=d; };

  /* ---- ошибки: строка в коде автора, а не в песочнице ---- */
  function строкаИз(e){
    const st=String(e&&e.stack||''), re=/model\.js:(\d+):(\d+)/g; let m;
    while((m=re.exec(st))){ const L=+m[1]-1; if(L>=1&&L<=строкКода) return L; }
    return null;
  }
  function ошибка(где,e,доп){
    const r={где, msg:String(e&&e.message||e), line:строкаИз(e)};
    if(e&&e.name&&e.name!=='Error') r.msg=e.name+': '+r.msg;
    const м=/\bd\.(\w+) is not a function/.exec(r.msg);
    if(м) r.msg+=` — у d нет метода ${м[1]}; рисуйте только методами из инструкции (line, path, rect, circle, ball, block, spring, arrow, force, text, label…)`;
    if(/(document|window|canvas|fetch|require|setTimeout|setInterval|localStorage) is not defined/.test(r.msg)) r.msg+=' — в песочнице этого нет: модель общается с приложением только через simulation({...})';
    return Object.assign(r,доп||{});
  }
  class ОшибкаАвтора extends Error{ constructor(где,e){ super(String(e&&e.message||e)); this.где=где; this.причина=e; } }
  /* методы зовём от самого определения: ИИ часто пишет this.помощник(s) */
  function вызвать(где,f,...арг){ try{ return f.apply(М&&М.D||null,арг); }catch(e){ if(e instanceof ОшибкаАвтора) throw e; throw new ОшибкаАвтора(где,e); } }
  const наружу=(e,доп)=>e instanceof ОшибкаАвтора? ошибка(e.где,e.причина,доп) : ошибка('песочница',e,доп);

  /* ---- разбор определения ---- */
  const ИЗВЕСТНЫЕ=new Set(['title','name','params','presets','init','step','draw','readouts','graphs','view','dt','static','schema',
    'handles','probe','description','format','timeUnit']);
  const числ=v=>typeof v==='number'&&isFinite(v);
  let М=null;                              // разобранное определение
  const предупреждения=[], ошибки=[];
  function разобрать(D){
    if(!D||typeof D!=='object'){ ошибки.push({где:'simulation',msg:'simulation({...}) не вызвана или вызвана не с объектом'}); return null; }
    for(const k of Object.keys(D)) if(!ИЗВЕСТНЫЕ.has(k)) предупреждения.push({где:'simulation',msg:`неизвестное поле «${k}» — оно не используется`});
    for(const k of ['init','draw']) if(typeof D[k]!=='function') ошибки.push({где:k,msg:`нет функции ${k}(...)`});
    if(!D.static && typeof D.step!=='function') ошибки.push({где:'step',msg:'нет функции step(s, dt, p); у неподвижной сцены поставьте static: true'});
    const m={title:String(D.title||D.name||'Без названия').slice(0,90), params:[], видимость:{}, presets:[], graphs:[],
      static:!!D.static, schema:!!D.schema, dt:1/240, timeUnit:typeof D.timeUnit==='string'?D.timeUnit.slice(0,8):'с',
      handles:typeof D.handles==='function', probe:typeof D.probe==='function'};
    if(D.dt!=null){ if(числ(D.dt)&&D.dt>=1e-5&&D.dt<=0.1) m.dt=D.dt; else предупреждения.push({где:'dt',msg:'dt должен быть числом от 0.00001 до 0.1 с — взят 1/240'}); }
    const ключи=new Set();
    if(D.params!=null&&!Array.isArray(D.params)) ошибки.push({где:'params',msg:'params должен быть массивом'});
    for(const [i,q0] of (Array.isArray(D.params)?D.params:[]).entries()){
      let q=q0||{}; const где=`params[${i}]`;
      if(q.type==='group'){ m.params.push({type:'group',label:String(q.label||'').slice(0,60)}); continue; }
      const key=String(q.key||'');
      if(!/^[A-Za-zА-Яа-яЁё_$][\wА-Яа-яЁё$]*$/.test(key)){ ошибки.push({где,msg:`у параметра нет ключа key (или в нём пробелы): ${JSON.stringify(q.key)}`}); continue; }
      if(ключи.has(key)){ ошибки.push({где,msg:`ключ «${key}» повторяется`}); continue; } ключи.add(key);
      const п={key,label:String(q.label||key).slice(0,80)};
      if(q.unit) п.unit=String(q.unit).slice(0,16);
      const усл=q.if||q.visible; if(typeof усл==='function'){ m.видимость[key]=усл; п.усл=1; }
      if(q.default==null&&q.value!=null) q=Object.assign({},q,{default:q.value});
      if(q.type==='check'||q.type==='checkbox'||q.type==='bool'||q.type==='boolean'){ п.type='check'; п.default=!!q.default; }
      else if(q.type==='select'||Array.isArray(q.options)){
        п.type='select';
        п.options=(Array.isArray(q.options)?q.options:[]).map(o=>typeof o==='object'&&o?{v:String(o.v!=null?o.v:o.value),t:String(o.t!=null?o.t:(o.label!=null?o.label:(o.v!=null?o.v:o.value))).slice(0,60)}:{v:String(o),t:String(o)});
        if(!п.options.length){ ошибки.push({где,msg:`у выбора «${key}» нет options`}); continue; }
        п.default=п.options.some(o=>o.v===String(q.default))?String(q.default):п.options[0].v;
        if(q.default!=null&&String(q.default)!==п.default) предупреждения.push({где,msg:`default «${q.default}» нет среди options — взят «${п.default}»`});
      } else {
        let {min,max,step}=q, d=q.default!=null?q.default:q.value;
        if(!числ(min)||!числ(max)||min>=max){ ошибки.push({где,msg:`у «${key}» нужны числа min < max`}); continue; }
        if(!числ(step)||step<=0){ step=+((max-min)/100).toPrecision(1); }
        if(!числ(d)){ предупреждения.push({где,msg:`у «${key}» нет числа default — взят min`}); d=min; }
        if(d<min||d>max){ предупреждения.push({где,msg:`default у «${key}» вне [min, max] — подрезан`}); d=Math.min(max,Math.max(min,d)); }
        Object.assign(п,{min,max,step,default:d});
      }
      m.params.push(п);
    }
    const ключПар=new Set(m.params.filter(q=>q.key).map(q=>q.key));
    for(const [i,пр] of (Array.isArray(D.presets)?D.presets:[]).entries()){
      if(!пр||typeof пр.values!=='object'){ предупреждения.push({где:`presets[${i}]`,msg:'у примера нет values'}); continue; }
      const v={}; for(const [k,x] of Object.entries(пр.values)) if(ключПар.has(k)) v[k]=x; else предупреждения.push({где:`presets[${i}]`,msg:`в примере неизвестный параметр «${k}»`});
      m.presets.push({name:String(пр.name||`Пример ${i+1}`).slice(0,80),values:v});
    }
    m.графикиФ=[];
    for(const [i,g] of (Array.isArray(D.graphs)?D.graphs:[]).entries()){
      if(!g||typeof g.get!=='function'){ ошибки.push({где:`graphs[${i}]`,msg:'у графика нет функции get(s, p)'}); continue; }
      const gg={label:String(g.label||`график ${i+1}`).slice(0,60),unit:String(g.unit||'').slice(0,16)};
      if(Array.isArray(g.series)) gg.series=g.series.slice(0,3).map(x=>String(x).slice(0,30));
      m.graphs.push(gg); m.графикиФ.push(g.get);
    }
    if(m.static&&m.graphs.length) предупреждения.push({где:'graphs',msg:'у неподвижной сцены (static) графиков по времени не бывает — они скрыты'});
    m.D=D; return m;
  }

  /* ---- запись рисунка ---- */
  const ПАЛИТРА=new Set(['ink','ink2','ink3','accent','blue','second','teal','third','purple','violet','danger','red','ok','green',
    'measure','orange','line','gray','grey','black','white','canvas','background','gravity','normal','friction','tension','elastic','buoyancy',
    'water','oil','mercury','honey','blood','glycerin','alcohol']);
  const ЛИМИТ_КОМАНД=6000, ЛИМИТ_ТОЧЕК=60000;
  function новыйРисунок(){
    const cmds=[], стек=[]; let м={c:1,s:0,x:0,y:0}, точек=0, nan=0, обрезано=false;
    const рамка={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
    const чужиеЦвета=new Set(), проблемы=new Set();
    const T=(x,y)=>{ const X=м.c*x-м.s*y+м.x, Y=м.s*x+м.c*y+м.y;
      if(X<рамка.x0) рамка.x0=X; if(X>рамка.x1) рамка.x1=X; if(Y<рамка.y0) рамка.y0=Y; if(Y>рамка.y1) рамка.y1=Y; return [X,Y]; };
    const ч=v=>{ if(!числ(v)){ nan++; throw 0; } return v; };
    const цвет=c=>{ if(c==null||c===true||c===false) return c;
      if(typeof c==='object'&&числ(c.T)) return 'T:'+c.T;
      c=String(c).trim().slice(0,40);
      if(!ПАЛИТРА.has(c)&&!/^T:\d/.test(c)) чужиеЦвета.add(c);
      return c; };
    const стиль=o=>{ if(!o||typeof o!=='object') return {}; const r={};
      if(o.color!=null) r.c=цвет(o.color);
      if(o.fill!=null) r.f=o.fill===true?true:(o.fill===false?false:цвет(o.fill));
      if(числ(o.width)) r.w=Math.min(20,Math.max(0.2,o.width));
      if(o.dash) r.d=Array.isArray(o.dash)?o.dash.slice(0,4).map(Number).filter(числ):true;
      if(числ(o.alpha)) r.a=Math.min(1,Math.max(0,o.alpha));
      if(o.label!=null) r.t=String(o.label).slice(0,120);
      if(числ(o.size)) r.z=Math.min(40,Math.max(0.5,o.size));
      if(o.bold) r.b=1;
      if(o.align) r.al=String(o.align);
      if(числ(o.dx)) r.dx=o.dx; if(числ(o.dy)) r.dy=o.dy;
      return r; };
    const добавить=(cmd,n)=>{ if(cmds.length>=ЛИМИТ_КОМАНД||точек+(n||1)>ЛИМИТ_ТОЧЕК){ обрезано=true; return; } точек+=n||1; cmds.push(cmd); };
    const безопасно=f=>function(...a){ try{ f(...a); }catch(e){ if(e!==0){ проблемы.add(String(e&&e.message||e)); } } return d; };
    const точки=pts=>{ if(!Array.isArray(pts)) throw new TypeError('ожидался массив точек [[x, y], …]');
      const out=[]; for(const q of pts){ if(!q) continue; const x=Array.isArray(q)?q[0]:q.x, y=Array.isArray(q)?q[1]:q.y; out.push(T(ч(x),ч(y))); } return out; };
    const поворот=()=>Math.atan2(м.s,м.c);
    const d={
      save:безопасно(()=>{ стек.push(Object.assign({},м)); }),
      restore:безопасно(()=>{ if(стек.length) м=стек.pop(); }),
      translate:безопасно((x,y)=>{ const [X,Y]=[м.c*ч(x)-м.s*ч(y)+м.x, м.s*x+м.c*y+м.y]; м.x=X; м.y=Y; }),
      rotate:безопасно(a=>{ ч(a); const c=Math.cos(a), s=Math.sin(a); const nc=м.c*c-м.s*s, ns=м.s*c+м.c*s; м.c=nc; м.s=ns; }),
      line:безопасно((x1,y1,x2,y2,o)=>{ добавить(['P',[T(ч(x1),ч(y1)),T(ч(x2),ч(y2))],стиль(o)],2); }),
      path:безопасно((pts,o)=>{ const п=точки(pts); if(п.length<2) return; const st=стиль(o); if(o&&o.close) st.cl=1; добавить(['P',п,st],п.length); }),
      polygon:безопасно((pts,o)=>{ const п=точки(pts); if(п.length<3) return; const st=стиль(o); st.cl=1; добавить(['P',п,st],п.length); }),
      trail:безопасно((pts,o)=>{ const п=точки(pts); if(п.length<2) return; добавить(['TR',п,стиль(o)],п.length); }),
      rect:безопасно((x,y,w,h,o)=>{ ч(x);ч(y);ч(w);ч(h); добавить(['P',[T(x,y),T(x+w,y),T(x+w,y+h),T(x,y+h)],Object.assign(стиль(o),{cl:1})],4); }),
      circle:безопасно((x,y,r,o)=>{ добавить(['C',...T(ч(x),ч(y)),Math.abs(ч(r)),стиль(o)]); }),
      dot:безопасно((x,y,o)=>{ добавить(['D',...T(ч(x),ч(y)),стиль(o)]); }),
      particles:безопасно((pts,o)=>{ const п=точки(pts); добавить(['PT',п,стиль(o)],п.length); }),
      text:безопасно((x,y,s,o)=>{ добавить(['T',...T(ч(x),ч(y)),String(s).slice(0,200),стиль(o)]); }),
      label:безопасно((x,y,s,o)=>{ добавить(['LB',...T(ч(x),ч(y)),String(s).slice(0,200),стиль(o)]); }),
      ball:безопасно((x,y,r,o)=>{ добавить(['B',...T(ч(x),ч(y)),Math.abs(ч(r)),стиль(o)]); }),
      block:безопасно((x,y,w,h,o)=>{ ч(x);ч(y);ч(w);ч(h); добавить(['BL',[T(x,y),T(x+w,y),T(x+w,y+h),T(x,y+h)],стиль(o)],4); }),
      spring:безопасно((x1,y1,x2,y2,o)=>{ const st=стиль(o); if(o&&числ(o.coils)) st.n=Math.max(2,Math.min(60,Math.round(o.coils)));
        if(o&&числ(o.radius)) st.r=Math.abs(o.radius); добавить(['SP',T(ч(x1),ч(y1)),T(ч(x2),ч(y2)),st],2); }),
      ground:безопасно((x1,y1,x2,y2,o)=>{ добавить(['G',T(ч(x1),ч(y1)),T(ч(x2),ч(y2)),стиль(o)],2); }),
      pivot:безопасно((x,y,o)=>{ добавить(['PV',...T(ч(x),ч(y)),стиль(o)]); }),
      arrow:безопасно((x1,y1,x2,y2,o)=>{ добавить(['A',T(ч(x1),ч(y1)),T(ч(x2),ч(y2)),стиль(o)],2); }),
      force:безопасно((x,y,fx,fy,o)=>{ const k=o&&числ(o.scale)?o.scale:0.1, st=стиль(o); if(o&&o.kind) st.k=String(o.kind);
        добавить(['F',T(ч(x),ч(y)),T(x+ч(fx)*k,y+ч(fy)*k),st],2); }),
      angle:безопасно((cx,cy,r,a0,a1,o)=>{ const п=поворот(); добавить(['AN',...T(ч(cx),ч(cy)),Math.abs(ч(r)),ч(a0)+п,ч(a1)+п,стиль(o)]); }),
      dimension:безопасно((x1,y1,x2,y2,s,o)=>{ const st=стиль(o); if(o&&числ(o.offset)) st.o=o.offset; добавить(['DM',T(ч(x1),ч(y1)),T(ч(x2),ч(y2)),String(s==null?'':s).slice(0,80),st],2); }),
      vessel:безопасно((x0,x1,yb,yt,o)=>{ const [a,b]=T(ч(x0),ч(yb)), [c]=T(ч(x1),ч(yb)), [,e]=T(x0,ч(yt)); добавить(['VS',a,c,b,e,o&&o.bottom===false?0:1,стиль(o)],2); }),
      liquid:безопасно((x0,y0,x1,y1,o)=>{ const [a,b]=T(ч(x0),ч(y0)), [c,e]=T(ч(x1),ч(y1)); const st=стиль(o);
        st.kind=String(o&&o.kind||'water'); if(o&&Array.isArray(o.surface)) st.s=o.surface.slice(0,200).map(v=>числ(v)?v+м.y:e);
        добавить(['LQ',a,b,c,e,st],2); }),
      gas:безопасно((x,y,w,h,o)=>{ const [a,b]=T(ч(x),ч(y)); добавить(['GS',a,b,Math.abs(ч(w)),ч(h),o&&числ(o.T)?o.T:300,o&&числ(o.density)?o.density:1],2); }),
      cylinder:безопасно(o=>{ o=o||{}; const [x,низ]=T(ч(o.x||0),ч(o.bottom||0));
        const мол=(Array.isArray(o.molecules)?o.molecules:[]).slice(0,400).filter(q=>q&&числ(q[0])&&числ(q[1])).map(q=>({x:q[0],y:q[1]}));
        добавить(['CY',{x,низ,ш:Math.abs(ч(o.width||1)),H:Math.abs(ч(o.height||2)),верхГаза:низ+Math.abs(ч(o.gasHeight!=null?o.gasHeight:1)),
          T:числ(o.T)?o.T:300,мол,тепло:{heat:'нагрев',cool:'холод',insulated:'изол'}[o.heat]||null,плотн:числ(o.density)?o.density:1}],4+мол.length); }),
      thermometer:безопасно((x,y,h,k,o)=>{ добавить(['TH',...T(ч(x),ч(y)),Math.abs(ч(h)),ч(k),стиль(o)]); }),
      gauge:безопасно((x,y,r,k,o)=>{ добавить(['GA',...T(ч(x),ч(y)),Math.abs(ч(r)),ч(k),стиль(o)]); }),
      heater:безопасно((x,y,w,o)=>{ добавить(['HT',...T(ч(x),ч(y)),Math.abs(ч(w)),o&&o.on===false?0:1,o&&o.cold?1:0]); }),
      jet:безопасно((pts,widths,o)=>{ const п=точки(pts); const ш=(Array.isArray(widths)?widths:п.map(()=>+widths||0.05)).slice(0,п.length).map(v=>числ(v)?Math.abs(v):0.02);
        while(ш.length<п.length) ш.push(ш[ш.length-1]||0.02); добавить(['JT',п,ш,String(o&&o.kind||'water')],п.length); }),
      drop:безопасно((x,y,r,o)=>{ добавить(['DR',...T(ч(x),ч(y)),Math.abs(ч(r)),String(o&&o.kind||'water')]); }),
      caption:безопасно(lines=>{ const L=(Array.isArray(lines)?lines:[lines]).slice(0,6).map(q=>Array.isArray(q)?[String(q[0]).slice(0,200),цвет(q[1]||'ink2'),q[2]?1:0]:[String(q).slice(0,200),'ink2',0]);
        добавить(['CA',L]); })
    };
    d.vector=d.arrow;
    return {d, cmds, рамка, итог:()=>({nan,обрезано,чужиеЦвета:[...чужиеЦвета],проблемы:[...проблемы]})};
  }

  /* ---- кадр: рисунок, показания, ручки ---- */
  function показания(s,p){
    if(typeof М.D.readouts!=='function') return [];
    const r=вызвать('readouts',М.D.readouts,s,p); if(!Array.isArray(r)) throw new ОшибкаАвтора('readouts',new TypeError('readouts должна вернуть массив строк вида [название, значение, единица]'));
    return r.slice(0,24).filter(Boolean).map(q=>Array.isArray(q)?[String(q[0]).slice(0,60), числ(q[1])?q[1]:(typeof q[1]==='string'?q[1].slice(0,40):(q[1]==null?'—':NaN)), String(q[2]==null?'':q[2]).slice(0,16)]:[String(q),'','']);
  }
  let ручкиСейчас=[];
  function ручки(s,p){
    if(!М.handles) return null;
    const r=вызвать('handles',М.D.handles,s,p); ручкиСейчас=[];
    if(!Array.isArray(r)) return [];
    return r.slice(0,16).filter(h=>h&&числ(h.x)&&числ(h.y)).map((h,i)=>{ ручкиСейчас[i]=h; return {id:i,x:h.x,y:h.y,label:h.label!=null?String(h.label).slice(0,80):''}; });
  }
  function графики(s,p){
    return М.графикиФ.map((g,i)=>{ const v=вызвать(`graphs[${i}].get`,g,s,p); const a=Array.isArray(v)?v.slice(0,3):[v];
      return a.map(x=>x==null?null:(числ(x)?x:NaN)); });
  }
  function рисунок(s,p){
    const р=новыйРисунок(); вызвать('draw',М.D.draw,р.d,s,p); return р;
  }
  function вид(p,р){
    let v=М.D.view;
    if(typeof v==='function') v=вызвать('view',v,p);
    if(v&&!Array.isArray(v.x)&&числ(v.xmin)&&числ(v.xmax)&&числ(v.ymin)&&числ(v.ymax)) v={x:[v.xmin,v.xmax],y:[v.ymin,v.ymax]};
    const ок=v&&Array.isArray(v.x)&&Array.isArray(v.y)&&числ(v.x[0])&&числ(v.x[1])&&числ(v.y[0])&&числ(v.y[1])&&v.x[1]>v.x[0]&&v.y[1]>v.y[0];
    if(ок) return {x:[v.x[0],v.x[1]],y:[v.y[0],v.y[1]]};
    const b=р&&р.рамка; if(b&&isFinite(b.x0)){ const w=Math.max(b.x1-b.x0,1e-6), h=Math.max(b.y1-b.y0,1e-6), m=Math.max(w,h)*0.12;
      return {x:[b.x0-m,b.x1+m],y:[b.y0-m,b.y1+m],сам:1}; }
    return {x:[-5,5],y:[-3,3],сам:1};
  }
  function видимость(p){
    const r={}; for(const [k,f] of Object.entries(М.видимость)){ try{ r[k]=!!f(p); }catch(_){ r[k]=true; } } return r;
  }
  function кадр(s,p,опц){
    const р=рисунок(s,p), итог=р.итог();
    const r={t:числ(s.t)?s.t:0, list:р.cmds, ro:показания(s,p), hs:ручки(s,p), чужиеЦвета:итог.чужиеЦвета};
    if(опц&&опц.вид) r.view=вид(p,р);
    return r;
  }

  /* ---- живая модель ---- */
  let S=null, P=null, поколение=-1, запас=0, были=new Set(), точкиГрафиков=[], следТочка=0;
  const ШАГ_ГРАФИКА=0.025;
  function копия(p){ return JSON.parse(JSON.stringify(p||{})); }
  function начать(p){
    P=копия(p); S=вызвать('init',М.D.init,P);
    if(!S||typeof S!=='object') throw new ОшибкаАвтора('init',new TypeError('init(p) должна вернуть объект состояния, например { t: 0, x: 0 }'));
    if(!числ(S.t)) S.t=0;
    запас=0; были=new Set(); точкиГрафиков=[]; следТочка=S.t;
    if(М.graphs.length&&!М.static){ точкиГрафиков.push([S.t,графики(S,P)]); следТочка=S.t+ШАГ_ГРАФИКА; }
  }
  function шагать(dt){
    if(М.static) return null;
    запас+=Math.max(0,Math.min(dt,2)); const t0=performance.now(); let шагов=0, стоп=null;
    while(запас>=М.dt){
      вызвать('step',М.D.step,S,М.dt,P); запас-=М.dt; шагов++;
      if(!числ(S.t)) S.t=0;
      if(М.graphs.length&&S.t>=следТочка-1e-12){ точкиГрафиков.push([S.t,графики(S,P)]); следТочка=S.t+ШАГ_ГРАФИКА; }
      const st=S.stop!=null?S.stop:S.__stop;
      if(st!=null&&st!==false){ S.stop=null; S.__stop=null; const msg=String(st).slice(0,160);
        if(!были.has(msg)){ были.add(msg); стоп=msg; запас=0; break; } }
      if(шагов>=20000||(шагов%64===0&&performance.now()-t0>120)){ запас=0; break; }
    }
    return стоп;
  }
  function ответКадр(k,gen,доп){
    const f=кадр(S,P,доп);
    f.k=k; f.gen=gen; f.samples=точкиГрафиков; точкиГрафиков=[];
    return f;
  }

  /* ---- проверка: холостой прогон на разных наборах параметров ---- */
  function случайныеПараметры(rnd){
    const p={}; for(const q of М.params){ if(!q.key) continue;
      if(q.type==='check') p[q.key]=rnd()<0.5; else if(q.type==='select') p[q.key]=q.options[Math.floor(rnd()*q.options.length)].v;
      else { const v=q.min+(q.max-q.min)*rnd(); p[q.key]=+(Math.round(v/q.step)*q.step).toFixed(10); } }
    return p;
  }
  function поУмолчанию(){ const p={}; for(const q of М.params) if(q.key) p[q.key]=q.default; return p; }
  function проверить(){
    const rnd=помощь.seeded(1234), отчёт={ошибки:ошибки.slice(),предупреждения:предупреждения.slice(),наборов:0,шагов:0,мсШаг:0,мсРисунок:0,команд:0};
    if(отчёт.ошибки.length) return отчёт;
    const база=поУмолчанию(), наборы=[{имя:'значения по умолчанию',p:база}];
    for(const пр of М.presets) наборы.push({имя:`пример «${пр.name}»`,p:Object.assign({},база,пр.values)});
    const числовые=М.params.filter(q=>q.key&&q.type==null);
    for(const q of числовые.slice(0,6)){ наборы.push({имя:`${q.key} = min`,p:Object.assign({},база,{[q.key]:q.min})}); наборы.push({имя:`${q.key} = max`,p:Object.assign({},база,{[q.key]:q.max})}); }
    for(let i=0;i<4;i++) наборы.push({имя:'случайный набор',p:Object.assign({},база,случайныеПараметры(rnd))});
    for(const q of М.params.filter(q=>q.type==='select')) for(const o of q.options) наборы.push({имя:`${q.key} = «${o.v}»`,p:Object.assign({},база,{[q.key]:o.v})});
    const виденоОш=new Set(), предуп=new Set(отчёт.предупреждения.map(x=>x.msg));
    const ош=(e,набор)=>{ const r=наружу(e,{набор:набор.имя,params:набор.p}); const ключ=r.где+'|'+r.msg; if(виденоОш.has(ключ)) return; виденоОш.add(ключ); отчёт.ошибки.push(r); };
    const пред=(где,msg,набор)=>{ if(предуп.has(msg)) return; предуп.add(msg); отчёт.предупреждения.push({где,msg,набор:набор&&набор.имя}); };
    let мсШаг=0, нШаг=0, мсРис=0, нРис=0, цвета=new Set(), сменилось=false, остановок=0, первый=null;
    for(const набор of наборы.slice(0,40)){
      отчёт.наборов++;
      try{
        послать({k:'где',fn:'init',набор:набор.имя});
        начать(набор.p);
        const сНан=x=>{ const путь=[]; const обход=(o,п,гл)=>{ if(гл>4||путь.length) return;
          if(typeof o==='number'){ if(!isFinite(o)) путь.push(п); return; }
          if(Array.isArray(o)){ for(let i=0;i<Math.min(o.length,200);i++) обход(o[i],п+'['+i+']',гл+1); return; }
          if(o&&typeof o==='object') for(const k of Object.keys(o).slice(0,60)) обход(o[k],п?п+'.'+k:k,гл+1); };
          обход(x,'',0); return путь[0]; };
        const осмотр=(когда)=>{
          const t0=performance.now(); послать({k:'где',fn:'draw',набор:набор.имя}); const р=рисунок(S,P); мсРис+=performance.now()-t0; нРис++;
          const и=р.итог(); отчёт.команд=Math.max(отчёт.команд,р.cmds.length);
          if(и.nan) пред('draw',`в draw координаты или размеры не числа (NaN) — ${и.nan} фигур не нарисовано (${когда})`,набор);
          if(и.обрезано) пред('draw','рисунок слишком большой (больше 6000 фигур или 60000 точек) — лишнее отброшено',набор);
          for(const пр of и.проблемы) пред('draw',пр,набор);
          и.чужиеЦвета.forEach(c=>цвета.add(c));
          if(!р.cmds.length) пред('draw','draw ничего не рисует',набор);
          const сл=JSON.stringify(р.cmds).length; if(первый===null&&набор===наборы[0]) первый=сл+'|'+JSON.stringify(р.cmds).slice(0,4000); else if(набор===наборы[0]&&первый!==сл+'|'+JSON.stringify(р.cmds).slice(0,4000)) сменилось=true;
          послать({k:'где',fn:'readouts',набор:набор.имя});
          const ro=показания(S,P); ro.forEach(q=>{ if(typeof q[1]==='number'&&!isFinite(q[1])) пред('readouts',`показание «${q[0]}» = NaN или бесконечность (${когда})`,набор); });
          if(М.graphs.length){ const g=графики(S,P); g.forEach((a,i)=>a.forEach(v=>{ if(typeof v==='number'&&!isFinite(v)) пред('graphs',`график «${М.graphs[i].label}» даёт NaN (${когда})`,набор); })); }
          if(М.handles) ручки(S,P);
          const н=сНан(S); if(н) пред('step',`в состоянии s.${н} получилось NaN или бесконечность (${когда})`,набор);
        };
        осмотр('сразу после init');
        if(М.handles&&ручкиСейчас.length){ послать({k:'где',fn:'handles drag',набор:набор.имя});
          for(const h of ручкиСейчас){ if(typeof h.drag!=='function'){ пред('handles','у ручки нет функции drag(x, y, p)',набор); continue; }
            const r=вызвать('handles.drag',h.drag,h.x+0.1,h.y+0.1,копия(P));
            if(r==null||typeof r!=='object') пред('handles','drag(x, y, p) должна вернуть объект новых значений, например { L: 2 }',набор);
            else for(const k of Object.keys(r)) if(!М.params.some(q=>q.key===k)) пред('handles',`drag возвращает неизвестный параметр «${k}»`,набор); } }
        if(М.probe){ послать({k:'где',fn:'probe',набор:набор.имя}); const r=вызвать('probe',М.D.probe,0,0,S,P);
          if(r!=null&&!Array.isArray(r)) пред('probe','probe должна вернуть массив строк или null',набор); }
        if(!М.static){
          const всего=набор===наборы[0]?8:3; let t=0; const t0=S.t;
          послать({k:'где',fn:'step',набор:набор.имя});
          while(t<всего){ const t0=performance.now(); const n0=Math.round(0.25/М.dt);
            for(let i=0;i<n0;i++){ вызвать('step',М.D.step,S,М.dt,P); нШаг++; if(!числ(S.t)){ пред('step','s.t стало не числом — время должно расти: s.t += dt',набор); S.t=t; }
              const st=S.stop!=null?S.stop:S.__stop; if(st!=null&&st!==false){ остановок++; S.stop=null; S.__stop=null; } }
            мсШаг+=performance.now()-t0; t+=0.25; послать({k:'где',fn:'step',набор:набор.имя});
            if(t%1<0.25) осмотр(`на t ≈ ${t.toFixed(0)} с`); }
          отчёт.шагов+=нШаг;
          if(числ(S.t)&&S.t<=t0+1e-9) пред('step','s.t не растёт — в конце step нужно s.t += dt, иначе время и графики стоят',набор);
        }
      }catch(e){ ош(e,набор); }
    }
    отчёт.мсШаг=нШаг?мсШаг/нШаг:0; отчёт.мсРисунок=нРис?мсРис/нРис:0;
    if(отчёт.мсШаг>0.5) отчёт.предупреждения.push({где:'step',msg:`step медленный: ${отчёт.мсШаг.toFixed(2)} мс за шаг (нужно меньше 0,5) — сцена будет тормозить; уменьшите число тел или увеличьте dt`});
    if(отчёт.мсРисунок>8) отчёт.предупреждения.push({где:'draw',msg:`draw медленный: ${отчёт.мсРисунок.toFixed(1)} мс за кадр (нужно меньше 8)`});
    if(цвета.size) отчёт.предупреждения.push({где:'draw',msg:`цвета не из палитры: ${[...цвета].slice(0,6).join(', ')} — заменены ближайшими; пишите имена: ink, ink2, ink3, accent, second, third, danger, ok, measure`});
    if(!М.static&&!сменилось&&!отчёт.ошибки.length) отчёт.предупреждения.push({где:'draw',msg:'за 8 секунд рисунок не изменился — step не двигает модель или draw не читает состояние s'});
    отчёт.остановок=остановок;
    return отчёт;
  }

  /* ---- запуск кода автора ---- */
  let мета=null;
  try{
    вызвать('код',код);
    if(вызовов>1) предупреждения.push({где:'simulation',msg:'simulation(...) вызвана несколько раз — взят последний вызов'});
    М=разобрать(ОПР);
    if(!М||ошибки.length){ послать({k:'fail',ошибки,предупреждения}); }
    else {
      мета={title:М.title,params:М.params,presets:М.presets,graphs:М.static?[]:М.graphs,static:М.static,schema:М.schema,
        handles:М.handles,probe:М.probe,timeUnit:М.timeUnit,предупреждения};
      послать({k:'meta',мета});
    }
  }catch(e){ послать({k:'fail',ошибки:[наружу(e)],предупреждения}); }

  self.addEventListener('message',e=>{
    const m=e.data||{};
    if(!М||ошибки.length) return;
    try{
      if(m.k==='init'){ поколение=m.gen; начать(m.p); const f=ответКадр('frame',m.gen,{вид:true}); f.vis=видимость(P); послать(f); }
      else if(m.k==='step'){ if(m.gen!==поколение||!S) return; P=копия(m.p||P); const стоп=шагать(+m.dt||0); const f=ответКадр('frame',m.gen); if(стоп) f.stop=стоп; послать(f); }
      else if(m.k==='redraw'){ if(m.gen!==поколение||!S) return; послать(ответКадр('frame',m.gen,{вид:true})); }
      else if(m.k==='drag'){ const h=ручкиСейчас[m.id]; let ch=null;
        if(h&&typeof h.drag==='function'){ const r=вызвать('handles.drag',h.drag,+m.x,+m.y,копия(m.p)); if(r&&typeof r==='object') ch=r; }
        const чист={}; if(ch) for(const [k,v] of Object.entries(ch)){ const q=М.params.find(x=>x.key===k); if(!q) continue;
          if(q.type==='check') чист[k]=!!v; else if(q.type==='select'){ if(q.options.some(o=>o.v===String(v))) чист[k]=String(v); } else if(числ(v)) чист[k]=v; }
        послать({k:'drag',gen:m.gen,req:m.req,changes:чист}); }
      else if(m.k==='probe'){ if(!S) return; let r=вызвать('probe',М.D.probe,+m.x,+m.y,S,P);
        r=Array.isArray(r)?r.slice(0,8).map(x=>String(x).slice(0,80)):null; послать({k:'probe',req:m.req,lines:r}); }
      else if(m.k==='check'){ послать({k:'check',отчёт:проверить()}); }
    }catch(err){ послать({k:'error',gen:m.gen,ошибка:наружу(err)}); }
  });
}

/* ---------- 2. Поток: запуск, сообщения, сторож ---------- */
function очиститьКодИИ(код){
  /* ИИ почти всегда оборачивает ответ в ```js … ``` и добавляет текст
     вокруг. Берём содержимое первого блока кода, если он есть. */
  let s=String(код||'').replace(/\r\n?/g,'\n');
  const m=/```[a-zA-Z]*\n([\s\S]*?)```/.exec(s); if(m) s=m[1];
  return s.replace(/^\uFEFF/,'').trim();
}
function создатьПоток(кодИсх){
  const код=очиститьКодИИ(кодИсх), строк=код.split('\n').length;
  const текст=`self.__строк=${строк};self.__код=function(){\n${код}\n};(${песочницаПотока.toString()})();\n//# sourceURL=model.js`;
  const п={код, строк, мета:null, мёртв:false, слушатели:new Set(), запрос:0, сторож:null, последнее:null};
  let ок, отказ; п.готов=new Promise((a,b)=>{ ок=a; отказ=b; });
  try{ п.w=new Worker('data:text/javascript;charset=utf-8,'+encodeURIComponent(текст)); }
  catch(e){ п.мёртв=true; отказ({ошибки:[{где:'песочница',msg:'браузер не дал создать песочницу: '+(e&&e.message||e)}],предупреждения:[]}); return п; }
  const ждатьЗагрузку=setTimeout(()=>{ if(!п.мета){ п.убить(); отказ({ошибки:[{где:'код',msg:'код не загрузился за 5 секунд — вероятно, бесконечный цикл вне функций'}],предупреждения:[]}); } },5000);
  п.w.onerror=e=>{ e.preventDefault&&e.preventDefault();
    const стр=e.lineno?e.lineno-1:null, msg=String(e.message||'ошибка').replace(/^Uncaught\s+/,'');
    if(!п.мета){ clearTimeout(ждатьЗагрузку); п.убить(); отказ({ошибки:[{где:'код',msg,line:стр>=1&&стр<=строк?стр:null}],предупреждения:[]}); }
    else п.сообщить({k:'error',ошибка:{где:'песочница',msg}}); };
  п.w.onmessage=e=>{ const m=e.data||{};
    if(m.k==='meta'){ clearTimeout(ждатьЗагрузку); п.мета=m.мета; ок(m.мета); return; }
    if(m.k==='fail'){ clearTimeout(ждатьЗагрузку); п.убить(); отказ({ошибки:m.ошибки||[],предупреждения:m.предупреждения||[]}); return; }
    if(m.k==='где'){ п.последнее=m; if(п.сторож&&п.сторожЧто==='check'){ п.снятьСторожа(); п.поставитьСторожа(4000,'check'); } return; }
    п.снятьСторожа(); п.сообщить(m); };
  п.послать=(m,мс)=>{ if(п.мёртв) return false; п.w.postMessage(m); п.поставитьСторожа(мс||2500,m.k); return true; };
  п.поставитьСторожа=(мс,что)=>{ if(п.сторож) return; п.сторожЧто=что; п.сторож=setTimeout(()=>{ п.сторож=null;
    const где=п.последнее?` (в ${п.последнее.fn}${п.последнее.набор?', набор: '+п.последнее.набор:''})`:'';
    п.убить(); п.сообщить({k:'error',ошибка:{где:что==='check'?(п.последнее&&п.последнее.fn)||'проверка':что,msg:`модель не отвечает дольше ${(мс/1000).toFixed(1)} с${где} — похоже на бесконечный цикл или слишком тяжёлый расчёт`,повис:true}}); },мс); };
  п.снятьСторожа=()=>{ if(п.сторож){ clearTimeout(п.сторож); п.сторож=null; } };
  п.сообщить=m=>{ for(const f of п.слушатели) try{ f(m); }catch(e){ console.error(e); } };
  п.убить=()=>{ п.снятьСторожа(); if(!п.мёртв){ п.мёртв=true; try{ п.w.terminate(); }catch(_){} } };
  return п;
}
/* Проверка целиком: загрузка, разбор, прогон. Возвращает отчёт для Мастерской. */
function проверитьКод(код){
  return new Promise(готово=>{
    const п=создатьПоток(код);
    п.готов.then(мета=>{
      const f=m=>{ if(m.k==='check'){ п.слушатели.delete(f); п.убить(); готово(Object.assign(m.отчёт,{мета})); }
        else if(m.k==='error'){ п.слушатели.delete(f); п.убить(); готово({ошибки:[m.ошибка],предупреждения:мета.предупреждения||[],мета}); } };
      п.слушатели.add(f); п.послать({k:'check'},6000);
    },отказ=>готово(Object.assign({наборов:0},отказ)));
  });
}

/* ---------- 3. Цвета: имена палитры → токены темы; чужие — к ближайшему ---------- */
const ЦВЕТА_ПАЛИТРЫ={ink:'--ink',ink2:'--ink-2',ink3:'--ink-3',accent:'--accent',blue:'--accent',second:'--second',teal:'--second',
  third:'--third',purple:'--third',violet:'--third',danger:'--danger',red:'--danger',ok:'--ok',green:'--ok',measure:'--measure',
  orange:'--measure',line:'--line',gray:'--ink-3',grey:'--ink-3',black:'--ink',white:'--canvas',canvas:'--canvas',background:'--canvas',
  gravity:'--f-grav',normal:'--f-norm',friction:'--f-fric',tension:'--f-tens',elastic:'--f-elas',buoyancy:'--f-arch'};
const ЖИДКОСТИ_САМ={water:'вода',oil:'масло',mercury:'ртуть',honey:'мёд',blood:'кровь',glycerin:'глицерин',alcohol:'спирт'};
/* образцы для «примагничивания»: цвета светлой темы — тогда «#e33» всегда
   станет красным темы, какая бы тема ни стояла */
const ОБРАЗЦЫ_ЦВЕТОВ=[['ink','#1c1b18'],['ink3','#6f6b61'],['accent','#2346c8'],['second','#1f7a6d'],['third','#8a3a9e'],
  ['danger','#c23b22'],['ok','#2c7a3f'],['measure','#b4561b']];
const _чужойЦвет=new Map();
function ближайшийЦвет(c){
  if(_чужойЦвет.has(c)) return _чужойЦвет.get(c);
  let rgb=null;
  try{ const x=document.createElement('canvas').getContext('2d'); x.fillStyle='#010203'; x.fillStyle=c;
    if(x.fillStyle!=='#010203'||/^#?010203$/i.test(c)) rgb=АРТ.rgb(x.fillStyle); }catch(_){}
  let имя='ink2';
  if(rgb){
    const hsl=([r,g,b])=>{ r/=255; g/=255; b/=255; const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, d=mx-mn;
      if(!d) return [0,0,l]; const s=d/(1-Math.abs(2*l-1)); let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4; return [(h*60+360)%360,s,l]; };
    const [h,s,l]=hsl(rgb);
    if(s<0.18||l<0.08||l>0.94) имя=l<0.3?'ink':(l>0.85?'line':'ink3');
    else { let лучш=1e9;
      for(const [n,hex] of ОБРАЗЦЫ_ЦВЕТОВ.slice(2)){ const [h2]=hsl(АРТ.rgb(hex)); const dh=Math.min(Math.abs(h-h2),360-Math.abs(h-h2)); if(dh<лучш){ лучш=dh; имя=n; } } }
  }
  _чужойЦвет.set(c,имя); return имя;
}
function цветСам(c,запас){
  if(c==null||c===true||c===false) c=запас||'ink2';
  c=String(c);
  if(/^T:/.test(c)) return АРТ.ц(АРТ.цветT(+c.slice(2)||300),1);
  if(ЖИДКОСТИ_САМ[c]) return АРТ.ц(АРТ.тон(ЖИДКОСТИ_САМ[c]),1);
  const токен=ЦВЕТА_ПАЛИТРЫ[c]||ЦВЕТА_ПАЛИТРЫ[ближайшийЦвет(c)];
  return css(токен)||'#666';
}
function заливкаСам(c){ const rgb=АРТ.rgb(цветСам(c))||[100,100,100]; return АРТ.ц(rgb,АРТ.тёмный()?0.26:0.18); }

/* ---------- 4. Исполнение списка команд ---------- */
function рисоватьКомандыСам(ctx,list,v){
  if(!Array.isArray(list)) return [];
  const px=1/ppm(), lw=w=>VIEW.lw(w==null?1.5:w), подписи=[];
  const ок=x=>typeof x==='number'&&isFinite(x);
  const пт=q=>Array.isArray(q)&&ок(q[0])&&ок(q[1]);
  const линия=(st,по)=>{ ctx.strokeStyle=цветСам(st.c,по); ctx.lineWidth=lw(st.w);
    ctx.setLineDash(st.d?(Array.isArray(st.d)&&st.d.length?st.d.map(x=>x*px):[6*px,4*px]):EMPTY_DASH); };
  for(const cmd of list.slice(0,6000)){
    if(!Array.isArray(cmd)) continue;
    const [op]=cmd;
    ctx.save();
    try{
      const st=(cmd[cmd.length-1]&&typeof cmd[cmd.length-1]==='object'&&!Array.isArray(cmd[cmd.length-1]))?cmd[cmd.length-1]:{};
      if(ок(st.a)) ctx.globalAlpha=st.a;
      switch(op){
        case 'P': case 'TR': { const pts=cmd[1]; if(!Array.isArray(pts)||pts.length<2||!pts.every(пт)) break;
          ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]);
          if(st.cl) ctx.closePath();
          if(op==='TR'){ ctx.globalAlpha*=0.55; линия(Object.assign({w:1.2},st),'ink3'); ctx.stroke(); break; }
          if(st.f){ ctx.fillStyle=st.f===true?заливкаСам(st.c||'ink2'):цветСам(st.f); ctx.fill(); }
          if(!st.f||st.c){ линия(st,'ink2'); ctx.stroke(); }
          break; }
        case 'C': { const [,x,y,r]=cmd; if(!ок(x)||!ок(y)||!ок(r)) break; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
          if(st.f){ ctx.fillStyle=st.f===true?заливкаСам(st.c||'accent'):цветСам(st.f); ctx.fill(); }
          if(!st.f||st.c){ линия(st,'ink2'); ctx.stroke(); } break; }
        case 'D': { const [,x,y]=cmd; if(!ок(x)||!ок(y)) break; ctx.fillStyle=цветСам(st.c,'ink'); ctx.beginPath(); ctx.arc(x,y,(st.z||3)*px,0,Math.PI*2); ctx.fill(); break; }
        case 'PT': { const pts=cmd[1]; if(!Array.isArray(pts)) break; const r=(st.z||2.5)*px; ctx.fillStyle=цветСам(st.c,'ink2'); ctx.beginPath();
          for(const q of pts) if(пт(q)){ ctx.moveTo(q[0]+r,q[1]); ctx.arc(q[0],q[1],r,0,Math.PI*2); } ctx.fill(); break; }
        case 'T': { const [,x,y,s]=cmd; if(!ок(x)||!ок(y)) break;
          VIEW.text(ctx,s,x+(st.dx||0)*px,y+(st.dy||0)*px,цветСам(st.c,'ink2'),Math.max(7,st.z||11),st.al==='left'||st.al==='right'?st.al:'center',!!st.b); break; }
        case 'LB': { const [,x,y,s]=cmd; if(!ок(x)||!ок(y)) break; VIEW.label(ctx,s,x,y,st.dx!=null?st.dx:6,st.dy!=null?-st.dy:-8,цветСам(st.c,'ink2')); break; }
        case 'B': { const [,x,y,r]=cmd; if(!ок(x)||!ок(y)||!ок(r)) break; АРТ.шар(ctx,x,y,r,АРТ.rgb(цветСам(st.c||st.f,'accent'))); if(st.t) подписи.push([st.t,x,y+r,st.c||'ink2']); break; }
        case 'BL': { const pts=cmd[1]; if(!Array.isArray(pts)||!pts.every(пт)) break; ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
          for(const q of pts.slice(1)) ctx.lineTo(q[0],q[1]); ctx.closePath();
          ctx.fillStyle=заливкаСам(st.f&&st.f!==true?st.f:(st.c||'accent')); ctx.fill();
          ctx.strokeStyle=цветСам(st.c,'ink2'); ctx.lineWidth=lw(st.w||1.4); ctx.stroke();
          if(st.t){ const cx=pts.reduce((a,q)=>a+q[0],0)/pts.length, cy=pts.reduce((a,q)=>a+q[1],0)/pts.length; VIEW.text(ctx,st.t,cx,cy,цветСам(st.c,'ink2'),st.z||11,'center',false); }
          break; }
        case 'SP': { const [,a,b]=cmd; if(!пт(a)||!пт(b)) break; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<1e-9) break;
          const ux=(b[0]-a[0])/L, uy=(b[1]-a[1])/L, n=st.n||10, r=st.r!=null?st.r:Math.min(L*0.12,14*px)+0*px, lead=Math.min(L*0.12,12*px);
          ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(a[0]+ux*lead,a[1]+uy*lead);
          for(let i=0;i<=2*n;i++){ const k=lead+(L-2*lead)*i/(2*n), s=i===0||i===2*n?0:(i%2?1:-1)*r; ctx.lineTo(a[0]+ux*k-uy*s,a[1]+uy*k+ux*s); }
          ctx.lineTo(b[0],b[1]); линия(Object.assign({w:1.4},st),'ink2'); ctx.lineJoin='round'; ctx.stroke(); break; }
        case 'G': { const [,a,b]=cmd; if(!пт(a)||!пт(b)) break; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<1e-9) break;
          const ux=(b[0]-a[0])/L, uy=(b[1]-a[1])/L, nx=uy, ny=-ux, h=8*px, шаг=9*px;
          ctx.strokeStyle=цветСам(st.c,'ink3'); ctx.lineWidth=lw(1.4); ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke();
          ctx.globalAlpha*=0.6; ctx.lineWidth=lw(1); ctx.beginPath();
          for(let k=шаг*0.5;k<=L;k+=шаг){ const x=a[0]+ux*k, y=a[1]+uy*k; ctx.moveTo(x,y); ctx.lineTo(x+nx*h-ux*h*0.7,y+ny*h-uy*h*0.7); }
          ctx.stroke(); break; }
        case 'PV': { const [,x,y]=cmd; if(!ок(x)||!ок(y)) break; ctx.fillStyle=css('--canvas')||'#fff'; ctx.strokeStyle=цветСам(st.c,'ink2'); ctx.lineWidth=lw(1.4);
          ctx.beginPath(); ctx.arc(x,y,4*px,0,Math.PI*2); ctx.fill(); ctx.stroke(); break; }
        case 'A': case 'F': { const [,a,b]=cmd; if(!пт(a)||!пт(b)) break;
          const c=op==='F'?цветСам(st.c||({gravity:'gravity',normal:'normal',friction:'friction',tension:'tension',elastic:'elastic',buoyancy:'buoyancy'}[st.k]||'danger')):цветСам(st.c,'ink2');
          if(st.w) АРТ.стрелка(ctx,a[0],a[1],b[0],b[1],c,lw(st.w)); else VIEW.arrow(ctx,a[0],a[1],b[0],b[1],c);
          if(st.t) подписи.push([st.t,b[0],b[1],c,true]); break; }
        case 'AN': { const [,x,y,r,a0,a1]=cmd; if(![x,y,r,a0,a1].every(ок)) break; линия(Object.assign({w:1.2},st),'ink3');
          ctx.beginPath(); ctx.arc(x,y,r,a0,a1,a1<a0); ctx.stroke();
          if(st.t){ const am=(a0+a1)/2; VIEW.text(ctx,st.t,x+Math.cos(am)*(r+12*px),y+Math.sin(am)*(r+12*px),цветСам(st.c,'ink2'),st.z||11,'center',false); } break; }
        case 'DM': { const [,a,b,s]=cmd; if(!пт(a)||!пт(b)) break; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<1e-9) break;
          const ux=(b[0]-a[0])/L, uy=(b[1]-a[1])/L, nx=-uy, ny=ux, o=(st.o!=null?st.o:14)*px, c=цветСам(st.c,'measure');
          const A1=[a[0]+nx*o,a[1]+ny*o], B1=[b[0]+nx*o,b[1]+ny*o];
          ctx.strokeStyle=c; ctx.lineWidth=lw(1); ctx.globalAlpha*=0.7; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(A1[0]+nx*4*px,A1[1]+ny*4*px);
          ctx.moveTo(b[0],b[1]); ctx.lineTo(B1[0]+nx*4*px,B1[1]+ny*4*px); ctx.stroke(); ctx.globalAlpha/=0.7;
          АРТ.стрелка(ctx,(A1[0]+B1[0])/2,(A1[1]+B1[1])/2,A1[0],A1[1],c,lw(1.1)); АРТ.стрелка(ctx,(A1[0]+B1[0])/2,(A1[1]+B1[1])/2,B1[0],B1[1],c,lw(1.1));
          if(s) VIEW.text(ctx,s,(A1[0]+B1[0])/2+nx*9*px,(A1[1]+B1[1])/2+ny*9*px,c,st.z||11,'center',false); break; }
        case 'VS': { const [,x0,x1,yb,yt,дно]=cmd; if(![x0,x1,yb,yt].every(ок)) break; АРТ.стакан(ctx,x0,x1,yb,yt,0,{дно:!!дно,lw:st.w||1.8}); break; }
        case 'LQ': { const [,x0,y0,x1,y1]=cmd; if(![x0,y0,x1,y1].every(ок)) break; const тон=ЖИДКОСТИ_САМ[st.kind]||'вода';
          const s=Array.isArray(st.s)&&st.s.length>1&&st.s.every(ок)?st.s:null;
          АРТ.жидкость(ctx,x0,y0,x1,y1,{тон,верх:s?(x=>{ const k=clamp((x-x0)/(x1-x0||1),0,1)*(s.length-1), i=Math.min(s.length-2,Math.floor(k)); return s[i]+(s[i+1]-s[i])*(k-i); }):null}); break; }
        case 'GS': { const [,x,y,w,h,T,dn]=cmd; if(![x,y,w,h,T,dn].every(ок)) break; АРТ.газ(ctx,x,y,w,h,T,dn); break; }
        case 'CY': { const o=cmd[1]; if(!o||![o.x,o.низ,o.ш,o.H,o.верхГаза,o.T].every(ок)) break; АРТ.цилиндр(ctx,o,v); break; }
        case 'TH': { const [,x,y,h,k]=cmd; if(![x,y,h,k].every(ок)) break; АРТ.термометр(ctx,x,y,h,k); break; }
        case 'GA': { const [,x,y,r,k]=cmd; if(![x,y,r,k].every(ок)) break; АРТ.прибор(ctx,x,y,r,k,null,st.c?цветСам(st.c):null); break; }
        case 'HT': { const [,x,y,w,вкл,хол]=cmd; if(![x,y,w].every(ок)) break; if(хол) АРТ.холод(ctx,x-w/2,y-Math.max(w*0.08,4*px)*2,w,Math.max(w*0.08,4*px)*2,!!вкл); else АРТ.горелка(ctx,x,y,w,0,вкл?1:0); break; }
        case 'JT': { const [,pts,ш,kind]=cmd; if(!Array.isArray(pts)||pts.length<2||!pts.every(пт)) break; АРТ.струя(ctx,pts,ш,ЖИДКОСТИ_САМ[kind]||'вода'); break; }
        case 'DR': { const [,x,y,r,kind]=cmd; if(![x,y,r].every(ок)) break; АРТ.капля(ctx,x,y,r,ЖИДКОСТИ_САМ[kind]||'вода'); break; }
        case 'CA': { if(Array.isArray(cmd[1])) подписи.push(['__пояснение',cmd[1]]); break; }
      }
    }catch(_){ /* одна плохая команда не должна валить рисунок */ }
    ctx.restore();
  }
  /* подписи — поверх всего, чтобы их не закрывали тела */
  let пояснение=null;
  for(const q of подписи){
    if(q[0]==='__пояснение'){ пояснение=q[1]; continue; }
    const [t,x,y,c,стрелка]=q; VIEW.label(ctx,t,x,y,стрелка?6:0,стрелка?-8:-12,typeof c==='string'&&c[0]!=='#'&&c.slice(0,3)!=='rgb'?цветСам(c):c);
  }
  return пояснение?пояснение.map(q=>[q[0],цветСам(q[1],'ink2'),!!q[2]]):null;
}

/* ---------- 5. Теневое определение: так SIMS видит самодельную модель ---------- */
function определениеСамодельной(id,запись,поток0){
  let поток=поток0;
  const м=поток.мета, def={id, title:м.title+' (самодельная)', самодельная:true, запись, поток, schema:м.schema, timeless:м.static, timeUnit:м.timeUnit,
    внешниеТочки:true, presets:м.presets, _вид:null, _пояснение:null, _видимость:{}, _зонд:{ключ:'',строки:null,ждём:false}, _запросы:0, _приложено:0};
  def.params=м.params.map(q=>{ const r=Object.assign({},q); delete r.усл; if(q.усл) r.если=()=>def._видимость[q.key]!==false; return r; });
  def.graphs=м.graphs.map((g,i)=>Object.assign({series:['']},g,{get:s=>(s.gv&&s.gv[i])||[null]}));
  if(!def.graphs.length) delete def.graphs;
  let поколение=0;
  const активна=()=>S.active===id&&RT[id];
  const слушать=m=>{
    const a=RT[id]; if(!a) return;
    const s=a.state;
    if(m.k==='error'){
      const e=m.ошибка||{}; s.ошибка=`Ошибка в модели${e.где?' ('+e.где+(e.line?', строка '+e.line:'')+')':''}: ${e.msg}`; s.ждём=false;
      if(активна()){ S.playing=false; setPlayIcon(); toast('Самодельная модель остановлена: ошибка — см. Мастерскую'); }
      return;
    }
    if(m.k==='frame'){
      if(m.gen!==поколение||s.gen!==поколение) return;
      s.ждём=false; s.t=m.t; s.list=m.list; s.ro=m.ro; s.hs=m.hs;
      if(m.vis){ const было=JSON.stringify(def._видимость); def._видимость=m.vis; if(было!==JSON.stringify(m.vis)&&активна()) renderParams(); }
      if(m.samples&&m.samples.length&&def.graphs){ for(const [t,v] of m.samples){ a.hist.push({t,v}); } s.gv=m.samples[m.samples.length-1][1];
        if(a.hist.length>4000){ const half=a.hist.length>>1, kept=[]; for(let i=0;i<half;i+=2) kept.push(a.hist[i]); a.hist=kept.concat(a.hist.slice(half)); } }
      if(m.stop){ s.__stop=m.stop; s.event={type:m.stop}; }
      /* вид зависит от параметров (длина нити → масштаб); пока тянут ручку,
         кадр не перестраиваем — иначе ручка уезжает из-под пальца */
      const тянут=typeof drag!=='undefined'&&drag&&drag.mode==='simtool';
      if(m.view){ const было=JSON.stringify(def._вид); def._вид=m.view; if(было!==JSON.stringify(m.view)) def._перевписать=true; }
      if(def._перевписать&&!тянут&&активна()){ def._перевписать=false; fitView(); }
      return;
    }
    if(m.k==='drag'){
      /* поколение не сверяем: каждое движение ручки перезапускает модель,
         и ответ на него всегда приходит «из прошлого» — а нужен он весь */
      if(m.req<def._приложено) return; def._приложено=m.req;
      const т=контекстИнструмента(a,null,null);
      for(const [k,v] of Object.entries(m.changes||{})){
        const pd=def.params.find(q=>q.key===k); if(!pd) continue;
        if(pd.type==='select'||pd.type==='check'){ if(a.params[k]!==v){ a.params[k]=v; a.инстр.тронуто.add(k); } }
        else т.set(k,v);
      }
      применитьИнструмент(a,!(typeof drag!=='undefined'&&drag&&drag.mode==='simtool'));
      if(!S.playing&&активна()) drawAll();
      return;
    }
    if(m.k==='probe'){ def._зонд.ждём=false; def._зонд.строки=m.lines; def._зонд.есть=true; if(!S.playing&&активна()) drawAll(); }
  };
  поток.слушатели.add(слушать);
  def.отключить=()=>{ поток.слушатели.delete(слушать); поток.убить(); };
  /* Поток убит сторожем (повис) — «Сброс» поднимает новый из того же кода. */
  let воскрешаем=false;
  function воскресить(){
    if(воскрешаем) return; воскрешаем=true;
    const н=создатьПоток(поток.код);
    н.готов.then(()=>{ воскрешаем=false; поток.слушатели.delete(слушать); поток=н; def.поток=н; н.слушатели.add(слушать);
      const a=RT[id]; if(a){ restart(a); if(!S.playing&&активна()) drawAll(); } },()=>{ воскрешаем=false; });
  }
  def.init=p=>{
    поколение++;
    const s={t:0,gen:поколение,list:[],ro:[],hs:[],gv:null,ждём:true,копится:0};
    if(поток.мёртв){ s.ошибка='Модель остановлена после ошибки — перезапускаю…'; воскресить(); }
    else поток.послать({k:'init',gen:поколение,p:JSON.parse(JSON.stringify(p))});
    return s;
  };
  def.step=(s,dt)=>{ if(!s.ошибка&&!м.static) s.копится=(s.копится||0)+dt; };
  def.draw=(ctx,s,v,p)=>{
    /* скопившееся время — одним запросом за кадр; пока поток считает, рисуем прошлый кадр */
    if(!s.ошибка&&!s.ждём&&s.копится>0&&s.gen===поколение&&!поток.мёртв){
      s.ждём=true; поток.послать({k:'step',gen:поколение,dt:s.копится,p}); s.копится=0; }
    const пояс=рисоватьКомандыСам(ctx,s.list,v);
    const строки=(пояс||[]).slice();
    if(s.ошибка) строки.push([s.ошибка,css('--danger'),true]);
    def._пояснение=строки.length?строки:null;
    if(строки.length) VIEW.пояснение(ctx,строки);
  };
  def.readouts=s=>(s.ro||[]).map(q=>q.slice());
  def.fit=(p,vp)=>{
    const b=def._вид||{x:[-5,5],y:[-3,3]}, w=b.x[1]-b.x[0], h=b.y[1]-b.y[0];
    return fitСПояснением(vp,w,h,(b.x[0]+b.x[1])/2,(b.y[0]+b.y[1])/2,def._пояснение,28);
  };
  if(м.handles||м.probe) def.tools=function(){
    const т=[];
    if(м.handles) т.push(РУЧКИ({name:'Ручки',ручки:(p,s)=>(s.hs||[]).map(h=>({id:'h'+h.id,x:h.x,y:h.y,имя:h.label,
      тянуть(тт,wx,wy){ if(поток.мёртв) return; поток.послать({k:'drag',gen:поколение,id:h.id,x:wx,y:wy,p:тт.p,req:++def._запросы}); }}))}));
    if(м.probe) т.push(ЗОНД({замер(p,s,x,y){
      const з=def._зонд, ключ=x.toFixed(6)+','+y.toFixed(6);
      if((з.ключ!==ключ||з.t!==s.t)&&!з.ждём&&!поток.мёртв){ if(з.ключ!==ключ) з.есть=false; з.ждём=true; з.ключ=ключ; з.t=s.t; поток.послать({k:'probe',x,y,req:++def._запросы}); }
      return з.ключ===ключ&&з.есть?з.строки:['…']; }}));
    return т;
  };
  return def;
}
