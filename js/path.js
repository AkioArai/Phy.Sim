/* =============================================================================
   «МОЙ ПУТЬ» — интерфейс модели ученика (2.0.0)

   Логика — в js/learn.js (УЧ), здесь только страница. Файл грузится ДО
   app.js, поэтому на верхнем уровне тут одни объявления функций: всё, что
   трогает помощники app.js ($, LS, S, openTopic…), вызывается позже —
   из запуска приложения (подключитьПуть) или по нажатию.

   Пять вкладок:
     Сегодня      — что повторить, какой навык починить, куда идти дальше;
     Карта        — граф предпосылок с состоянием каждой темы;
     Диагностика  — двенадцать задач по всему курсу и совет, с чего начать;
     Навыки       — ремонтные блоки: объяснение, приём, тренажёр;
     От вопроса   — вход для тех, кто пришёл не по программе.
   ============================================================================= */

let журналУч=null;
function естьПуть(){ return typeof УЧ!=='undefined'; }
function журнал(){
  if(!журналУч){
    журналУч=УЧ.починить(LS.get('journal',null));
    перенестиСтарыеОтметки();
  }
  return журналУч;
}
function сохранитьЖурнал(){ LS.set('journal',журналУч); }

/* Отметки «решено» из версий до 2.0.0 не знают, когда задача решалась.
   Переносим их как решённые три дня назад: темы, где решено достаточно,
   сразу попадут в «пора повторить» — честнее, чем считать их свежими. */
function перенестиСтарыеОтметки(){
  const ж=журналУч;
  if(ж.перенесено) return;
  const t0=Date.now()-3*УЧ.ДЕНЬ;
  let n=0;
  for(const t of ALL) for(const pr of t.problems||[]){
    const id=идЗадачи(t,pr);
    if(S.solved&&S.solved[id]&&!ж.задачи[id]){
      УЧ.записатьПопытку(ж,{тема:t.id,задача:id,уровень:pr.level,ok:true,t:t0+n,откуда:'старое'}); n++;
    }
  }
  ж.перенесено=1; сохранитьЖурнал();
}
function состояниеПути(){ return УЧ.состояние(журнал(),ALL); }

const СТАТУС={new:'не начата',work:'в работе',done:'освоена',due:'пора повторить',stuck:'трудности'};
const темаИд=id=>ALL.find(t=>t.id===id);
function когда(ts){
  const д=Math.round((ts-Date.now())/УЧ.ДЕНЬ);
  if(д<=0) return 'сегодня';
  if(д===1) return 'завтра';
  return 'через '+plural(д,'день','дня','дней');
}
function процент(x){ return Math.round(x*100)+' %'; }

/* ---------------- запись попыток из обычной вкладки «Задачи» ---------------- */
function единицаСИ(u){
  try{ const q=ВЫЧ.считать('1 '+u); return {k:q.siv, си:ВЫЧ.размерностьТекст(q.d)}; }catch(_){ return null; }
}
function веерДляЗадачи(pr,params,дано){
  if(!естьПуть()||!pr.sim||!SIMS[pr.sim]) return [];
  try{ return УЧ.веерОшибок(pr,params,SIMS[pr.sim],дано,естьВычислитель()?единицаСИ:null); }catch(_){ return []; }
}
function отметитьПопытку(t,pr,ok,веер,откуда){
  if(!естьПуть()) return;
  const в=(веер&&веер[0])||null;
  УЧ.записатьПопытку(журнал(),{тема:t.id,задача:идЗадачи(t,pr),уровень:pr.level,ok,
    вид:в?в.вид:'',навык:в?в.навык:'',откуда:откуда||'тема'});
  сохранитьЖурнал();
  обновитьЗначокПути();
}
/* Строка разбора под неверным ответом: что, похоже, произошло, и кнопка
   в ремонт навыка. */
function показатьВеер(куда,веер){
  let box=куда.querySelector('.pr-fan');
  if(!веер||!веер.length){ if(box) box.remove(); return; }
  if(!box){ box=document.createElement('div'); box.className='pr-fan'; куда.append(box); }
  const в=веер[0], н=УЧ.НАВЫКИ[в.навык];
  box.innerHTML=`<span class="pr-fan-i">?</span><span class="pr-fan-t">Похоже, ${esc(в.текст)}.`+
    (веер[1]?` Или: ${esc(веер[1].текст)}.`:'')+`</span>`+
    (н?`<button class="btn pr-fan-go" data-skill="${в.навык}">Починить: ${esc(н.имя.toLowerCase())}</button>`:'');
  const b=box.querySelector('.pr-fan-go');
  if(b) b.onclick=()=>открытьПуть('skills',{навык:b.dataset.skill});
}

/* ---------------- статус темы: дерево и шапка ---------------- */
function меткаТемы(t,сост){
  if(!естьПуть()||!(t.problems||[]).length) return null;
  сост=сост||состояниеПути();
  const x=сост.темы[t.id]; if(!x) return null;
  const m=document.createElement('span');
  m.className='tm s-'+x.статус;
  m.style.setProperty('--p',Math.round(x.освоение*100)+'%');
  m.title=`${СТАТУС[x.статус]} · освоение ${процент(x.освоение)}`;
  return m;
}
function полосаТемы(t){
  const box=document.getElementById('t-path'); if(!box) return;
  if(!естьПуть()||!(t.problems||[]).length){ box.innerHTML=''; box.classList.add('hidden'); return; }
  const сост=состояниеПути(), x=сост.темы[t.id];
  if(!x){ box.innerHTML=''; box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const бл=(x.статус==='stuck'||x.статус==='new'||x.статус==='work')?УЧ.блокеры(сост,ALL,t.id).slice(0,3):[];
  const срок=x.статус==='done'&&x.срок?` · повторить ${когда(x.срок)}`:'';
  box.innerHTML=`<button class="tp-main s-${x.статус}" title="Открыть «Мой путь»">
      <span class="tp-bar"><i style="width:${Math.round(x.освоение*100)}%"></i></span>
      <span class="tp-txt"><b>${СТАТУС[x.статус]}</b> · освоение ${процент(x.освоение)} · решено ${x.решено} из ${x.всего}${срок}</span>
    </button>`+
    (бл.length?`<div class="tp-need">${x.статус==='stuck'?'Мешает':'Сначала стоит'}: ${бл.map(b=>
      `<button class="tp-need-b s-${b.статус}" data-to="${b.id}">${esc(темаИд(b.id).title)} <small>${процент(b.освоение)}</small></button>`).join('')}</div>`:'');
  box.querySelector('.tp-main').onclick=()=>открытьПуть('map',{тема:t.id});
  box.querySelectorAll('.tp-need-b').forEach(b=>b.onclick=()=>{ openTopic(b.dataset.to); if(typeof autoCloseRail==='function') autoCloseRail(); });
}
function обновитьЗначокПути(){
  if(!естьПуть()) return;
  const сост=состояниеПути(), рем=УЧ.навыкиКРемонту(журнал());
  const n=сост.повторить.length+рем.length;
  for(const id of ['path-badge','m-path-badge']){
    const b=document.getElementById(id); if(!b) continue;
    b.textContent=n>9?'9+':String(n); b.classList.toggle('hidden',!n);
  }
  if(S.topic) полосаТемы(S.topic);
}

/* ---------------- карточка задачи ----------------
   Самодостаточная: условие, «Дано» с числами, поле ответа. Числа берутся
   не из симуляции, а подбираются датчиком с зерном — одна и та же
   карточка в течение дня показывает одно и то же. */
function данныеКарточки(t,pr,зерно){
  const def=SIMS[pr.sim];
  const {params,answer}=solvableParams(pr,def,seeded(зерно));
  const keys=answerParams(pr,params);
  const дано=def.params.filter(q=>q.type!=='group'&&keys.includes(q.key)).map(q=>{
    let v=params[q.key];
    if(q.type==='select'){ const o=(q.options||[]).find(x=>x.v===v); v=o?o.t:v; }
    else if(typeof v==='boolean') v=v?'да':'нет';
    else if(typeof v==='number') v=fmtNice(v).replace('.',',');
    return {label:q.label,value:v,unit:q.unit||''};
  });
  return {params,answer,дано};
}
function карточкаЗадачи(o){
  const {t,pr}=o, д=данныеКарточки(t,pr,o.зерно);
  const el=document.createElement('div'); el.className='pc';
  const точки=`<span class="dots">${'<i class="f"></i>'.repeat(pr.level)}${'<i></i>'.repeat(5-pr.level)}</span>`;
  el.innerHTML=`<div class="pc-h">${точки}<span class="pc-topic">${esc(t.title)}</span>
      ${SIMS[pr.sim].title!==t.title?`<span class="pc-sim">${esc(SIMS[pr.sim].title)}</span>`:''}${o.метка?`<span class="pc-tag">${esc(o.метка)}</span>`:''}</div>
    <div class="pc-st">${pr.statement}</div>
    ${д.дано.length?`<div class="pc-given"><span class="pc-gl">Дано</span>${д.дано.map(x=>
      `<span class="pc-g">${x.label}: <b>${x.value}</b>${x.unit&&!/^×/.test(x.unit)?' '+x.unit:x.unit?' '+x.unit:''}</span>`).join('')}</div>`:''}
    <div class="pc-ans">
      <input type="text" autocomplete="off" spellcheck="false" inputmode="decimal" placeholder="ответ${pr.unit?', '+pr.unit:''} — можно с единицами">
      <button class="btn primary pc-check">Проверить</button>
      <button class="btn pc-skip">${o.пропуск||'Не знаю'}</button>
      <button class="btn ghost pc-open" title="Открыть эту задачу в симуляции с теми же числами">В симуляции</button>
    </div>
    <div class="pc-out" aria-live="polite"></div>`;
  const inp=el.querySelector('input'), out=el.querySelector('.pc-out');
  let готово=false;
  const итог=(ok,веер,текст,пропуск)=>{
    готово=true; el.classList.add(ok?'ok':'no'); el.classList.add('done');
    out.innerHTML=`<div class="pc-v ${ok?'ok':'no'}">${текст}</div>`;
    if(!ok&&веер&&веер.length) показатьВеер(out,веер);
    el.querySelectorAll('.pc-check,.pc-skip').forEach(b=>b.disabled=true); inp.disabled=true;
    if(o.готово) o.готово(ok,веер||[],пропуск);
  };
  const проверить=()=>{
    if(готово) return;
    let u;
    if(естьВычислитель()){
      const р=ВЫЧ.ответЗадачи(inp.value,pr.unit);
      if(р.размерность){ out.innerHTML=`<div class="pc-v no">Размерность не та: ответ — в ${esc(pr.unit)} (${esc(р.надо)}), а у вас ${esc(р.есть)}. ${esc(р.подсказка)}</div>`; el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'),400); return; }
      if(р.ошибка){ out.innerHTML=`<div class="pc-v no">${esc(inp.value.trim()?р.ошибка:'введите число')}</div>`; return; }
      u=р.u;
    } else u=parseFloat(inp.value.replace(',','.'));
    if(!isFinite(u)){ out.innerHTML='<div class="pc-v no">введите число</div>'; return; }
    const ans=д.answer;
    const ok=Math.abs(u-ans)<=Math.max(Math.abs(ans)*0.015,1e-9);
    const веер=ok?[]:веерДляЗадачи(pr,д.params,u);
    итог(ok,веер,ok?`✓ Верно: ${fmtNice(ans).replace('.',',')} ${esc(pr.unit)}`:`✗ Не сходится. Верный ответ: ${fmtNice(ans).replace('.',',')} ${esc(pr.unit)}`);
  };
  el.querySelector('.pc-check').onclick=проверить;
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ e.preventDefault(); проверить(); } });
  el.querySelector('.pc-skip').onclick=()=>итог(false,[],`Ответ: ${fmtNice(д.answer).replace('.',',')} ${esc(pr.unit)}. ${pr.hint?'Подсказка: '+esc(pr.hint):''}`,true);
  el.querySelector('.pc-open').onclick=()=>{
    const r=rt(pr.sim); r.params=Object.assign({},r.params,д.params);
    закрытьПуть(); openTopic(t.id); openSim(pr.sim); restart(rt(pr.sim)); renderParams(); buildGraphs();
    if(isNarrow()) openSimMobile();
    toast('Числа задачи перенесены в симуляцию');
  };
  return el;
}

/* ---------------- панель ---------------- */
const ВКЛАДКИ_ПУТИ=[['today','Сегодня'],['map','Карта'],['diag','Диагностика'],['skills','Навыки'],['ask','От вопроса']];
const путь={вкладка:'today',тема:null,навык:null};
function собратьПуть(){
  let p=document.getElementById('path'); if(p) return p;
  p=document.createElement('div'); p.id='path'; p.className='path hidden';
  p.setAttribute('role','dialog'); p.setAttribute('aria-label','Мой путь');
  p.innerHTML=`<div class="path-box">
    <div class="path-h">
      <div class="path-title"><svg viewBox="0 0 24 24"><path d="M5 19c3-1 3-5 7-6s4-5 7-7"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="6" r="2"/></svg>Мой путь</div>
      <div class="path-tabs" role="tablist">${ВКЛАДКИ_ПУТИ.map(([id,имя])=>`<button role="tab" data-pt="${id}">${имя}</button>`).join('')}<i class="path-ink"></i></div>
      <button class="iconbtn path-x" title="Закрыть (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="path-body" id="path-body"></div></div>`;
  document.body.append(p);
  p.querySelector('.path-x').onclick=закрытьПуть;
  p.addEventListener('pointerdown',e=>{ if(e.target===p) закрытьПуть(); });
  p.querySelectorAll('[data-pt]').forEach(b=>b.onclick=()=>вкладкаПути(b.dataset.pt));
  p.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); закрытьПуть(); } e.stopPropagation(); });
  return p;
}
function открытьПуть(вкладка,опц){
  if(!естьПуть()){ toast('Модуль «Мой путь» не загрузился'); return; }
  const p=собратьПуть();
  опц=опц||{};
  if(опц.тема) путь.тема=опц.тема;
  if(опц.навык) путь.навык=опц.навык;
  p.classList.remove('hidden');
  document.documentElement.classList.add('path-on');
  if(typeof обновитьНав==='function') обновитьНав();
  вкладкаПути(вкладка||путь.вкладка);
}
function закрытьПуть(){
  const p=document.getElementById('path'); if(!p) return;
  p.classList.add('hidden'); document.documentElement.classList.remove('path-on');
  if(typeof обновитьНав==='function') обновитьНав();
  обновитьЗначокПути();
  if(typeof renderTree==='function') renderTree(($('#search')||{}).value||'');
}
const путьОткрыт=()=>{ const p=document.getElementById('path'); return !!p&&!p.classList.contains('hidden'); };
function вкладкаПути(id){
  путь.вкладка=id;
  const p=собратьПуть(), body=p.querySelector('#path-body');
  p.querySelectorAll('[data-pt]').forEach(b=>{ const on=b.dataset.pt===id; b.classList.toggle('on',on); b.setAttribute('aria-selected',on?'true':'false'); });
  // скользящая черта под вкладкой
  const on=p.querySelector('[data-pt].on'), ink=p.querySelector('.path-ink');
  if(on&&ink){ ink.style.width=on.offsetWidth+'px'; ink.style.transform=`translateX(${on.offsetLeft}px)`; }
  body.scrollTop=0;
  body.innerHTML='';
  ({today:рисоватьСегодня,map:рисоватьКарту,diag:рисоватьДиагностику,skills:рисоватьНавыки,ask:рисоватьВопросы})[id](body);
  typeset(body);
}

/* ---------------- Сегодня ---------------- */
function деньНомер(){ return Math.floor(Date.now()/УЧ.ДЕНЬ); }
function хэш(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function задачаДляПовтора(t){
  const ж=журнал();
  const с=(t.problems||[]).map((pr,i)=>({pr,i})).filter(x=>x.pr.sim&&SIMS[x.pr.sim]&&x.pr.level>=2&&x.pr.level<=4);
  if(!с.length) return null;
  // сначала те, что уже решались: повторение — это возврат, а не новое
  const было=с.filter(x=>ж.задачи[идЗадачи(t,x.pr)]);
  const пул=было.length?было:с;
  return пул[(деньНомер()+хэш(t.id))%пул.length];
}
function рисоватьСегодня(body){
  const сост=состояниеПути(), ж=журнал(), рем=УЧ.навыкиКРемонту(ж);
  const темы=Object.keys(сост.темы), счёт={new:0,work:0,done:0,due:0,stuck:0};
  for(const id of темы) счёт[сост.темы[id].статус]++;
  const пусто=!Object.keys(ж.задачи).length&&!ж.диагн;
  const сегменты=['done','due','work','stuck','new'].map(s=>`<i class="s-${s}" style="flex:${счёт[s]||0.0001}" title="${СТАТУС[s]}: ${счёт[s]}"></i>`).join('');
  body.innerHTML=`<div class="pt-sum">
      <div class="pt-sum-t"><b>${счёт.done+счёт.due}</b> из ${темы.length} тем освоено
        <span>· в работе ${счёт.work+счёт.stuck} · пора повторить ${счёт.due}</span></div>
      <div class="pt-seg">${сегменты}</div>
      <div class="pt-legend">${['done','due','work','stuck','new'].map(s=>`<span class="s-${s}"><i></i>${СТАТУС[s]}</span>`).join('')}</div>
    </div>`;
  const блок=(заг,под)=>{ const d=document.createElement('section'); d.className='pt-block';
    d.innerHTML=`<h3>${заг}</h3>${под?`<p class="pt-sub">${под}</p>`:''}`; body.append(d); return d; };
  if(пусто){
    const d=блок('С чего начать','Приложение пока ничего о вас не знает. Есть три дороги — выберите любую.');
    d.insertAdjacentHTML('beforeend',`<div class="pt-start">
      <button class="pt-card" data-go="diag"><b>Диагностика</b><span>12 задач по всему курсу, около 20 минут. В конце — с какой темы начать.</span></button>
      <button class="pt-card" data-go="map"><b>Карта курса</b><span>Все темы и связи между ними: что на чём держится.</span></button>
      <button class="pt-card" data-go="ask"><b>У меня вопрос</b><span>«Почему спутник не падает?» — сорок вопросов, каждый ведёт в тему и симуляцию.</span></button>
    </div>`);
    d.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>вкладкаПути(b.dataset.go));
  }
  if(сост.повторить.length){
    const d=блок('Повторить сегодня',`Эти темы вы освоили, но с тех пор прошло время. Одна задача на тему — со свежими числами. Решите — и тема отложится ${'на срок побольше'}.`);
    for(const id of сост.повторить.slice(0,3)){
      const t=темаИд(id), x=задачаДляПовтора(t); if(!x) continue;
      const к=карточкаЗадачи({t,pr:x.pr,зерно:деньНомер()*31+хэш(id),метка:'повторение',
        готово:(ok,веер)=>{ отметитьПопытку(t,x.pr,ok,веер,'повтор');
          const с=журнал().темы[id];
          к.insertAdjacentHTML('beforeend',`<div class="pc-next">${ok?`Тема отложена: следующее повторение ${когда(с.след)}.`:'Вернёмся к ней завтра. Посмотрите разбор ниже или откройте тему.'}
            <button class="btn ghost" data-open="${id}">Открыть тему</button></div>`);
          к.querySelector('[data-open]').onclick=()=>{ закрытьПуть(); openTopic(id); };
        }});
      d.append(к);
    }
    if(сост.повторить.length>3) d.insertAdjacentHTML('beforeend',`<p class="pt-sub">И ещё ${plural(сост.повторить.length-3,'тема','темы','тем')} — после этих.</p>`);
  }
  if(рем.length){
    const d=блок('Починить навык','Одни и те же промахи в разных задачах — это не случайность, а навык. Пять верных упражнений подряд, и он считается починенным.');
    const ряд=document.createElement('div'); ряд.className='pt-chips';
    for(const р of рем.slice(0,6)){
      const н=УЧ.НАВЫКИ[р.навык];
      const b=document.createElement('button'); b.className='pt-chip warn';
      b.innerHTML=`${esc(н.имя)} <small>${plural(р.ошибок,'промах','промаха','промахов')}</small>`;
      b.onclick=()=>{ путь.навык=р.навык; вкладкаПути('skills'); };
      ряд.append(b);
    }
    d.append(ряд);
  }
  if(сост.трудности.length){
    const d=блок('Где трудно','Здесь несколько промахов подряд. Часто дело не в самой теме, а в той, на которой она стоит.');
    for(const id of сост.трудности.slice(0,3)){
      const бл=УЧ.блокеры(сост,ALL,id).slice(0,3), t=темаИд(id);
      d.insertAdjacentHTML('beforeend',`<div class="pt-row"><button class="pt-link s-stuck" data-open="${id}">${esc(t.title)}</button>
        <span class="pt-arrow">${бл.length?'мешает:':'предпосылки в порядке — стоит перечитать разбор и ошибки темы'}</span>
        ${бл.map(b=>`<button class="pt-link s-${b.статус}" data-open="${b.id}">${esc(темаИд(b.id).title)} <small>${процент(b.освоение)}</small></button>`).join('')}</div>`);
    }
  }
  if(сост.фронт.length){
    const d=блок('Дальше по курсу','Всё, на чём эти темы держатся, у вас уже освоено.');
    const ряд=document.createElement('div'); ряд.className='pt-start';
    for(const id of сост.фронт.slice(0,3)){
      const t=темаИд(id), x=сост.темы[id];
      const b=document.createElement('button'); b.className='pt-card';
      b.innerHTML=`<b>${esc(t.title)}</b><span>${esc(t.section)} · ${x.статус==='new'?'не начата':`освоение ${процент(x.освоение)}`} · ${plural(t.problems.length,'задача','задачи','задач')}</span>`;
      b.onclick=()=>{ закрытьПуть(); openTopic(id); };
      ряд.append(b);
    }
    d.append(ряд);
  }
  if(!пусто&&!сост.повторить.length&&!рем.length&&!сост.трудности.length)
    блок('На сегодня всё','Повторять пока нечего, промахов, которые стоило бы чинить, нет. Можно идти дальше по курсу или заглянуть в «От вопроса».');
  body.querySelectorAll('[data-open]').forEach(b=>{ if(!b.onclick) b.onclick=()=>{ закрытьПуть(); openTopic(b.dataset.open); }; });
}

/* ---------------- Карта ----------------
   Слои — по длине самой длинной цепочки предпосылок: тема стоит ниже всех,
   на которых держится. Внутри слоя — порядок курса. */
function слоиКарты(){
  const темы=ALL.filter(t=>!/\.recap$/.test(t.id)&&t.id!=='intro');
  const глуб={};
  const g=id=>{ if(глуб[id]!==undefined) return глуб[id]; глуб[id]=0;
    const t=темаИд(id); let d=0; for(const n of (t&&t.needs)||[]) d=Math.max(d,g(n)+1); return глуб[id]=d; };
  for(const t of темы) g(t.id);
  const слои=[]; for(const t of темы){ (слои[глуб[t.id]]=слои[глуб[t.id]]||[]).push(t); }
  return слои.filter(Boolean);
}
function рисоватьКарту(body){
  const сост=состояниеПути(), слои=слоиКарты();
  const W=Math.max(300,(body.clientWidth||900)-24), n=Math.max.apply(null,слои.map(s=>s.length));
  const зазор=10, w=Math.min(168,Math.floor((W-зазор*(n+1))/n)), h=52, шагY=86;
  const pos={};
  слои.forEach((слой,y)=>{
    const ширина=слой.length*w+(слой.length-1)*зазор, x0=(W-ширина)/2;
    слой.forEach((t,k)=>{ pos[t.id]={x:x0+k*(w+зазор),y:14+y*шагY}; });
  });
  const H=14+слои.length*шагY;
  let рёбра='';
  for(const слой of слои) for(const t of слой) for(const nid of t.needs||[]){
    const a=pos[nid], b=pos[t.id]; if(!a||!b) continue;
    const x1=a.x+w/2, y1=a.y+h, x2=b.x+w/2, y2=b.y, my=(y1+y2)/2;
    const x=сост.темы[nid], жив=x&&(x.статус==='done'||x.статус==='due');
    рёбра+=`<path class="pm-e${жив?' on':''}" data-from="${nid}" data-to="${t.id}" d="M${x1} ${y1}C${x1} ${my},${x2} ${my},${x2} ${y2}"/>`;
  }
  let узлы='';
  for(const слой of слои) for(const t of слой){
    const p=pos[t.id], x=сост.темы[t.id]||{статус:'new',освоение:0};
    const фронт=сост.фронт.includes(t.id);
    const секц=typeof разделТемы==='function'?разделТемы(t):null;
    узлы+=`<g class="pm-n s-${x.статус}${фронт?' front':''}${путь.тема===t.id?' sel':''}${секц?' sx':''}" style="${секц?стильРаздела(секц):''}" data-id="${t.id}" transform="translate(${p.x},${p.y})" tabindex="0" role="button" aria-label="${esc(t.title)}: ${СТАТУС[x.статус]}">
      <title>${esc(t.title)}</title><rect width="${w}" height="${h}" rx="9"/>${секц?`<rect class="pm-sec" x="0" y="9" width="3" height="${h-18}" rx="1.5"/>`:''}
      <rect class="pm-fill" y="${h-4}" width="${Math.max(0,w*x.освоение)}" height="4" rx="2"/>
      <text x="9" y="19" class="pm-t">${esc(обрезать(t.title,w))}</text>
      <text x="9" y="36" class="pm-s">${esc(t.ch?t.section.split(' ')[0]+' · '+t.ch:t.section)} · ${Math.round(x.освоение*100)}%</text>
    </g>`;
  }
  body.innerHTML=`<div class="pm-help">Сверху — основания, ниже — темы, которые на них стоят. Линия светится, когда предпосылка освоена.
      Обведены темы <b class="pm-front-l">фронта</b> — к ним вы готовы прямо сейчас.</div>
    <div class="pm-wrap"><svg class="pm" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${рёбра}${узлы}</svg></div>
    <div class="pm-card" id="pm-card"></div>`;
  const svg=body.querySelector('svg');
  const выбрать=id=>{
    путь.тема=id;
    svg.querySelectorAll('.pm-n').forEach(g=>g.classList.toggle('sel',g.dataset.id===id));
    svg.querySelectorAll('.pm-e').forEach(e=>e.classList.toggle('hl',e.dataset.to===id||e.dataset.from===id));
    карточкаТемыНаКарте(body.querySelector('#pm-card'),id,сост);
  };
  svg.querySelectorAll('.pm-n').forEach(g=>{
    g.onclick=()=>выбрать(g.dataset.id);
    g.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); выбрать(g.dataset.id); } };
  });
  if(путь.тема&&pos[путь.тема]) выбрать(путь.тема);
}
function обрезать(s,w){ const max=Math.max(8,Math.floor((w-16)/7.6)); return s.length>max?s.slice(0,max-1)+'…':s; }
function карточкаТемыНаКарте(box,id,сост){
  const t=темаИд(id), x=сост.темы[id]; if(!t||!x){ box.innerHTML=''; return; }
  const бл=УЧ.блокеры(сост,ALL,id);
  const дальше=ALL.filter(u=>(u.needs||[]).includes(id));
  box.innerHTML=`<div class="pm-c-h"><b>${esc(t.title)}</b><span class="pm-st s-${x.статус}">${СТАТУС[x.статус]}</span></div>
    <div class="pm-c-bar"><i style="width:${Math.round(x.освоение*100)}%"></i></div>
    <div class="pm-c-l">Освоение ${процент(x.освоение)} · решено ${x.решено} из ${x.всего} · попыток ${x.попыток}${x.срок&&x.этап>=0?` · повторить ${когда(x.срок)}`:''}</div>
    ${бл.length?`<div class="pm-c-l">Не освоено из того, на чём она стоит: ${бл.slice(0,4).map(b=>`<button class="pt-link s-${b.статус}" data-open="${b.id}">${esc(темаИд(b.id).title)}</button>`).join(' ')}</div>`
      :`<div class="pm-c-l ok">Всё, на чём она стоит, освоено.</div>`}
    ${дальше.length?`<div class="pm-c-l">Открывает дорогу к: ${дальше.map(u=>esc(u.title)).join(', ')}</div>`:''}
    <div class="pm-c-act"><button class="btn primary" data-open="${id}">Открыть тему</button>
      <button class="btn" data-prob="${id}">К задачам</button></div>`;
  box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ закрытьПуть(); openTopic(b.dataset.open); });
  const пр=box.querySelector('[data-prob]');
  if(пр) пр.onclick=()=>{ закрытьПуть(); openTopic(id); const b=document.querySelector('#tabs button[data-tab="problems"]'); if(b) b.click(); };
}

/* ---------------- Диагностика ---------------- */
let диаг=null;
function начатьДиагностику(){
  const зерно=Date.now()%100000;
  const набор=УЧ.выбратьДиагностику(ALL,SIMS,seeded(зерно));
  диаг={зерно,набор:набор.map((x,k)=>Object.assign({},x,{зерно:зерно*13+k})),k:0,итоги:{},начало:Date.now()};
  LS.set('diagRun',диаг);
}
function рисоватьДиагностику(body){
  if(!диаг) диаг=LS.get('diagRun',null);
  const ж=журнал();
  if(!диаг||диаг.k>=диаг.набор.length){
    const было=ж.диагн;
    body.innerHTML=`<div class="dg-intro">
      <h3>Диагностика по всему курсу</h3>
      <p>Двенадцать задач — по одной из ключевых тем, от кинематики до квантов. Числа случайные, условие — как в обычной задаче курса.
         Калькулятор и вычислитель можно открывать; учебник — лучше не надо: смысл в том, чтобы увидеть, что помнится само.</p>
      <p>Не знаете — жмите «Не знаю»: это такой же полезный ответ. В конце — какие темы держат остальные и с какой начать.</p>
      <button class="btn primary big" id="dg-go">${было?'Пройти заново':'Начать'}</button>
    </div>`;
    if(было) body.append(итогДиагностики(было));
    body.querySelector('#dg-go').onclick=()=>{ начатьДиагностику(); вкладкаПути('diag'); };
    return;
  }
  const x=диаг.набор[диаг.k], t=темаИд(x.тема), pr=t.problems[x.i];
  body.innerHTML=`<div class="dg-prog"><span>Задача ${диаг.k+1} из ${диаг.набор.length}</span>
      <div class="dg-bar">${диаг.набор.map((y,k)=>`<i class="${k<диаг.k?(диаг.итоги[y.тема]==='ok'?'ok':'no'):k===диаг.k?'cur':''}"></i>`).join('')}</div>
      <button class="btn ghost" id="dg-stop">Прервать</button></div>`;
  const к=карточкаЗадачи({t,pr,зерно:x.зерно,метка:'диагностика',
    готово:(ok,веер,пропуск)=>{
      диаг.итоги[x.тема]=ok?'ok':пропуск?'skip':'fail';
      УЧ.записатьПопытку(журнал(),{тема:t.id,задача:идЗадачи(t,pr),уровень:pr.level,ok,
        вид:веер[0]?веер[0].вид:'',навык:веер[0]?веер[0].навык:'',откуда:'диагн'});
      сохранитьЖурнал();
      LS.set('diagRun',диаг);
      const дальше=document.createElement('button'); дальше.className='btn primary pc-nextbtn';
      const последняя=диаг.k===диаг.набор.length-1;
      дальше.textContent=последняя?'Посмотреть итог':'Следующая задача';
      дальше.onclick=()=>{ диаг.k++;
        if(диаг.k>=диаг.набор.length){ журнал().диагн={t:Date.now(),итоги:диаг.итоги}; сохранитьЖурнал(); LS.set('diagRun',null); диаг=null; обновитьЗначокПути(); }
        else LS.set('diagRun',диаг);
        вкладкаПути('diag'); };
      к.append(дальше); дальше.focus();
    }});
  body.append(к);
  body.querySelector('#dg-stop').onclick=()=>{ LS.set('diagRun',диаг); диаг=null; LS.set('diagRun',null); вкладкаПути('diag'); };
  setTimeout(()=>{ const i=к.querySelector('input'); if(i&&!isNarrow()) i.focus(); },60);
}
function итогДиагностики(д){
  const box=document.createElement('div'); box.className='dg-res';
  const совет=УЧ.советДиагностики(д.итоги,ALL);
  const темы=УЧ.ТЕМЫ_ДИАГНОСТИКИ.filter(id=>д.итоги[id]);
  const верно=темы.filter(id=>д.итоги[id]==='ok').length;
  box.innerHTML=`<h3>Итог от ${new Date(д.t).toLocaleDateString('ru-RU')}: ${верно} из ${темы.length}</h3>
    <div class="dg-grid">${темы.map(id=>{ const r=д.итоги[id];
      return `<button class="dg-t ${r}" data-open="${id}"><i>${r==='ok'?'✓':r==='skip'?'—':'✗'}</i>${esc(темаИд(id).title)}</button>`; }).join('')}</div>
    ${совет.начать?`<div class="dg-advice"><b>Начните с темы «${esc(темаИд(совет.начать).title)}».</b>
       Среди провалов у неё нет проваленных предпосылок — значит, её можно чинить прямо сейчас, и она потянет за собой остальные.
       ${совет.потом.length?`<br>Потом: ${совет.потом.map(id=>esc(темаИд(id).title)).join(' → ')}.`:''}
       <div class="pm-c-act"><button class="btn primary" data-open="${совет.начать}">Открыть «${esc(темаИд(совет.начать).title)}»</button>
       <button class="btn" data-go="map">Посмотреть на карте</button></div></div>`
      :`<div class="dg-advice ok"><b>Все двенадцать — верно.</b> Основания курса держатся. Дальше — по карте или «От вопроса».</div>`}`;
  box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ закрытьПуть(); openTopic(b.dataset.open); });
  const м=box.querySelector('[data-go]'); if(м) м.onclick=()=>{ путь.тема=совет.начать; вкладкаПути('map'); };
  return box;
}

/* ---------------- Навыки ---------------- */
const тренажёр={навык:null,упр:null,зерно:1};
function рисоватьНавыки(body){
  const ж=журнал(), рем=УЧ.навыкиКРемонту(ж), ошибок={};
  for(const р of рем) ошибок[р.навык]=р.ошибок;
  const ids=Object.keys(УЧ.НАВЫКИ);
  if(!путь.навык||!УЧ.НАВЫКИ[путь.навык]) путь.навык=(рем[0]&&рем[0].навык)||ids[0];
  body.innerHTML=`<div class="sk">
    <div class="sk-list">${ids.map(id=>{ const н=УЧ.НАВЫКИ[id], р=ж.тренажёр[id];
      return `<button class="sk-i${id===путь.навык?' on':''}" data-sk="${id}"><span>${esc(н.имя)}</span>
        ${ошибок[id]?`<small class="warn">${plural(ошибок[id],'промах','промаха','промахов')}</small>`:р&&р.починен?'<small class="ok">починен</small>':''}</button>`; }).join('')}</div>
    <div class="sk-main" id="sk-main"></div></div>`;
  body.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{ путь.навык=b.dataset.sk; тренажёр.упр=null; вкладкаПути('skills'); });
  блокНавыка(body.querySelector('#sk-main'),путь.навык);
}
function блокНавыка(box,id){
  const н=УЧ.НАВЫКИ[id], ж=журнал(), р=ж.тренажёр[id]||{серия:0,всего:0,верно:0,починен:0};
  // где этот промах случался: последние задачи с этим навыком
  const где=[];
  for(const zid in ж.задачи){ const з=ж.задачи[zid];
    for(const п of з.п) if(!п[1]&&п[4]===id){ где.push({тема:з.тема,t:п[0],zid}); } }
  где.sort((a,b)=>b.t-a.t);
  const приём=typeof ПРИЁМЫ!=='undefined'&&ПРИЁМЫ[н.приём];
  box.innerHTML=`<h3>${esc(н.имя)}</h3>
    <p class="sk-why">${н.суть}</p>
    <div class="sk-rule"><b>Правило</b>${н.правило}</div>
    ${приём?`<button class="op-chip sk-op" data-op="${н.приём}">Приём в справочнике: ${esc(приём.имя)}</button>`:''}
    ${где.length?`<div class="sk-where"><b>Где это было у вас</b>${[...new Set(где.map(x=>x.тема))].slice(0,5).map(id2=>{ const t=темаИд(id2);
       return t?`<button class="pt-link" data-open="${id2}">${esc(t.title)}</button>`:''; }).join('')}</div>`:''}
    <div class="sk-train" id="sk-train"></div>`;
  const ч=box.querySelector('.sk-op'); if(ч) ч.onclick=e=>{ e.stopPropagation(); открытьПриём(ч.dataset.op,null,ч); };
  box.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{ закрытьПуть(); openTopic(b.dataset.open); });
  const tr=box.querySelector('#sk-train');
  if(!н.упр){
    tr.innerHTML=`<div class="sk-no">Для этого навыка нет упражнений на числа: он чинится вниманием к условию, а не счётом.
      Вернитесь к задачам из списка выше и решите их, держа правило перед глазами.</div>`;
    return;
  }
  упражнение(tr,id,р);
}
function упражнение(tr,id,р){
  const н=УЧ.НАВЫКИ[id];
  if(!тренажёр.упр||тренажёр.навык!==id){
    тренажёр.навык=id; тренажёр.зерно=(Date.now()%9973)+1;
    тренажёр.упр=н.упр(seeded(тренажёр.зерно),естьВычислитель()?ВЫЧ:null);
  }
  const у=тренажёр.упр;
  const точки=`<span class="sk-dots" title="Пять верных подряд — навык починен">${[0,1,2,3,4].map(k=>`<i class="${k<р.серия?'on':''}"></i>`).join('')}</span>`;
  tr.innerHTML=`<div class="sk-t-h"><b>Тренажёр</b>${точки}<span class="sk-stat">${р.всего?`верно ${р.верно} из ${р.всего}`:''}${р.починен?' · починен '+new Date(р.починен).toLocaleDateString('ru-RU'):''}</span></div>
    <div class="sk-q">${esc(у.вопрос)}</div>
    <div class="pc-ans"><input type="text" autocomplete="off" inputmode="decimal" placeholder="ответ${у.единица?', '+у.единица:''}">
      <button class="btn primary sk-check">Проверить</button><button class="btn sk-next">Другое</button></div>
    <div class="pc-out"></div>`;
  const inp=tr.querySelector('input'), out=tr.querySelector('.pc-out');
  let сдано=false;
  const проверить=()=>{
    if(сдано){ тренажёр.упр=null; упражнение(tr,id,журнал().тренажёр[id]||{серия:0,всего:0,верно:0}); return; }
    let u;
    if(естьВычислитель()&&у.единица){ const q=ВЫЧ.ответЗадачи(inp.value,у.единица); if(q.ошибка||q.размерность){ out.innerHTML=`<div class="pc-v no">${esc(q.подсказка||q.ошибка||'введите число')}</div>`; return; } u=q.u; }
    else u=parseFloat(String(inp.value).replace(',','.').replace(/\s/g,''));
    if(!isFinite(u)){ out.innerHTML='<div class="pc-v no">введите число</div>'; return; }
    const ok=Math.abs(u-у.ответ)<=Math.max(Math.abs(у.ответ)*0.01,1e-9);
    const был=(журнал().тренажёр[id]||{}).починен||0;
    УЧ.записатьТренажёр(журнал(),id,ok); сохранитьЖурнал();
    const р2=журнал().тренажёр[id];
    const починен=р2.починен&&р2.починен!==был;
    сдано=true;
    out.innerHTML=`<div class="pc-v ${ok?'ok':'no'}">${ok?'✓ Верно':'✗ Нет'}: ${fmtNice(у.ответ).replace('.',',')} ${esc(у.единица)}. ${esc(у.пояснение)}</div>`+
      (починен?`<div class="sk-fixed">Пять подряд — навык починен. Старые промахи с ним больше не зовут в ремонт.</div>`:'');
    tr.querySelectorAll('.sk-dots i').forEach((d,k)=>d.classList.toggle('on',k<р2.серия||починен));
    tr.querySelector('.sk-check').textContent='Дальше';
    tr.querySelector('.sk-check').focus();
    обновитьЗначокПути();
  };
  tr.querySelector('.sk-check').onclick=проверить;
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){ e.preventDefault(); проверить(); } });
  tr.querySelector('.sk-next').onclick=()=>{ тренажёр.упр=null; упражнение(tr,id,журнал().тренажёр[id]||{серия:0,всего:0,верно:0}); };
  if(!isNarrow()) setTimeout(()=>inp.focus(),30);
}

/* ---------------- От вопроса ---------------- */
function рисоватьВопросы(body){
  const разделы=[...new Set(УЧ.ВОПРОСЫ.map(в=>в.раздел))];
  body.innerHTML=`<div class="aq-h"><p>Не обязательно идти по программе. Выберите вопрос — откроется тема, где на него отвечают,
      и симуляция, в которой ответ можно увидеть своими руками.</p>
    <input type="search" id="aq-q" placeholder="Найти вопрос…" autocomplete="off"></div>
    <div class="aq">${разделы.map(р=>`<section class="aq-s" data-r="${esc(р)}"><h4>${esc(р)}</h4>${УЧ.ВОПРОСЫ.filter(в=>в.раздел===р).map(в=>
      `<button class="aq-i" data-t="${в.тема}" data-s="${в.sim}"><span>${esc(в.вопрос)}</span><small>${esc(темаИд(в.тема).title)} · ${esc(SIMS[в.sim].title)}</small></button>`).join('')}</section>`).join('')}</div>`;
  body.querySelectorAll('.aq-i').forEach(b=>b.onclick=()=>{
    закрытьПуть(); openTopic(b.dataset.t); openSim(b.dataset.s);
    if(isNarrow()) openSimMobile();
  });
  const q=body.querySelector('#aq-q');
  q.addEventListener('keydown',e=>e.stopPropagation());
  q.oninput=()=>{ const s=q.value.trim().toLowerCase();
    body.querySelectorAll('.aq-i').forEach(b=>b.classList.toggle('hidden',!!s&&!b.textContent.toLowerCase().includes(s)));
    body.querySelectorAll('.aq-s').forEach(sec=>sec.classList.toggle('hidden',!sec.querySelector('.aq-i:not(.hidden)'))); };
}

/* ---------------- самопроверка в конспекте ---------------- */
function подключитьСамопроверку(pane,t){
  if(!естьПуть()) return;
  pane.querySelectorAll('.qa').forEach(el=>{
    const i=+el.dataset.i, box=el.querySelector('.qa-a'); if(!box||el.querySelector('.qa-self')) return;
    const было=журнал().вопросы[t.id+'#'+i];
    const d=document.createElement('div'); d.className='qa-self';
    d.innerHTML=`<span>Вы знали ответ?</span><button class="qa-y${было&&было[1]?' on':''}">Да</button><button class="qa-n${было&&!было[1]?' on':''}">Нет</button>`;
    box.after(d);
    const да=d.querySelector('.qa-y'), нет=d.querySelector('.qa-n');
    const отм=знал=>{ УЧ.записатьВопрос(журнал(),t.id,i,знал); сохранитьЖурнал();
      да.classList.toggle('on',знал); нет.classList.toggle('on',!знал); полосаТемы(t); };
    да.onclick=()=>отм(true); нет.onclick=()=>отм(false);
  });
}

/* ---------------- перенос в файл ---------------- */
/* Прогресс из файла сливается с текущим, а не заменяет: попытки
   объединяются по времени, из двух тренажёров берётся более долгий. */
function слитьЖурнал(ч){
  if(!естьПуть()||!ч) return;
  const ж=журнал(), д=УЧ.починить(ч);
  for(const id in д.задачи){
    const a=ж.задачи[id], b=д.задачи[id];
    if(!a){ ж.задачи[id]=b; continue; }
    const все={}; for(const п of a.п.concat(b.п)) все[п[0]+':'+п[1]]=п;
    a.п=Object.keys(все).map(k=>все[k]).sort((x,y)=>x[0]-y[0]).slice(-12);
    a.решена=Math.max(a.решена||0,b.решена||0);
  }
  for(const k in д.вопросы) if(!ж.вопросы[k]||ж.вопросы[k][0]<д.вопросы[k][0]) ж.вопросы[k]=д.вопросы[k];
  for(const k in д.навыки) ж.навыки[k]=[...new Set((ж.навыки[k]||[]).concat(д.навыки[k]))].sort((a,b)=>a-b).slice(-20);
  for(const k in д.тренажёр) if(!ж.тренажёр[k]||ж.тренажёр[k].всего<д.тренажёр[k].всего) ж.тренажёр[k]=д.тренажёр[k];
  for(const k in д.темы) if(!ж.темы[k]||ж.темы[k].послед<д.темы[k].послед) ж.темы[k]=д.темы[k];
  if(д.диагн&&(!ж.диагн||ж.диагн.t<д.диагн.t)) ж.диагн=д.диагн;
  сохранитьЖурнал(); обновитьЗначокПути();
}

/* ---------------- подключение ---------------- */
function подключитьПуть(){
  if(!естьПуть()) return;
  const b=document.getElementById('btn-path'); if(b) b.onclick=()=>путьОткрыт()?закрытьПуть():открытьПуть();
  const m=document.getElementById('m-path'); if(m) m.onclick=()=>открытьПуть();
  const d=document.getElementById('d-path'); if(d) d.onclick=()=>{ if(typeof drawer==='function') drawer(false); открытьПуть(); };
  const mi=document.getElementById('mi-path'); if(mi) mi.onclick=()=>{ const pm=document.getElementById('pop-simmenu'); if(pm) pm.classList.add('hidden'); открытьПуть(); };
  обновитьЗначокПути();
  addEventListener('resize',()=>{ if(путьОткрыт()&&путь.вкладка==='map') вкладкаПути('map'); });
}
