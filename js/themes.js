'use strict';
/* ===================== ТЕМЫ ОФОРМЛЕНИЯ (10.1.0) =====================
   До 10.1 каждая палитра была десятком токенов, выписанных руками в CSS.
   Здесь — движок: тема задаётся пятью цветами (фон, лист, текст, акцент,
   «красный карандаш» для измерений) и тоном (светлая или тёмная), а все
   остальные токены — линии, сетка сцены, вторичный текст, полоса управления,
   оттенки акцента — выводятся из них смешиванием. На этом движке стоят
   встроенные темы 10.1 («Чертёж», «Доска», «Солнечная»…), свои темы из
   конструктора и обмен темами кодом или файлом.

   Токены кладутся инлайном на <html> поверх палитры «Бумага и графит»: всё,
   чего движок не задаёт (тени, герой главной), остаётся от неё. */

const ТЕМЫ_ДВИЖКА={
  blueprint: {имя:'Чертёж',        тон:'dark',  фон:'#0c2140',лист:'#11305a',текст:'#e7eefc',акцент:'#ffd166',карандаш:'#ff8a5c',сцена:'#0e2850'},
  chalk:     {имя:'Доска',         тон:'dark',  фон:'#17221c',лист:'#1e2c25',текст:'#eef1e6',акцент:'#f2d06b',карандаш:'#ff9c7a',сцена:'#1b2821'},
  solar:     {имя:'Солнечная',     тон:'light', фон:'#eee8d5',лист:'#fdf6e3',текст:'#073642',акцент:'#2072b8',карандаш:'#c4470f'},
  solarnight:{имя:'Солнечная ночь',тон:'dark',  фон:'#00212b',лист:'#022d39',текст:'#eee8d5',акцент:'#3cb8ad',карандаш:'#e8834a'},
  lavender:  {имя:'Лаванда',       тон:'light', фон:'#efedf7',лист:'#fbfaff',текст:'#1d1a2b',акцент:'#6a4cd6',карандаш:'#c2410c'},
  coffee:    {имя:'Кофе',          тон:'dark',  фон:'#18140f',лист:'#221c16',текст:'#efe6da',акцент:'#e2a65a',карандаш:'#f0855a'}
};
/* цвета, которые тема не задаёт: опасность, второй и третий ряд, «верно» */
const ТЕМЫ_ЦВЕТА_ТОНА={
  light:{danger:'#c23b22',second:'#1f7a6d',ok:'#2c7a3f',third:'#8a3a9e'},
  dark: {danger:'#ff7a5e',second:'#59c4b3',ok:'#7fd18f',third:'#d59ae6'}
};

/* ---- цвет: разбор, смешивание, контраст ---- */
function тмRGB(h){ h=String(h||'').trim().replace('#',''); if(h.length===3) h=h.replace(/./g,'$&$&');
  if(!/^[0-9a-f]{6}$/i.test(h)) return [0,0,0]; return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); }
function тмHEX(c){ return '#'+c.map(v=>Math.round(Math.min(255,Math.max(0,v))).toString(16).padStart(2,'0')).join(''); }
/* смесь a и b: t = 0 — чистый a, t = 1 — чистый b */
function тмСмесь(a,b,t){ const x=тмRGB(a), y=тмRGB(b); return тмHEX(x.map((v,i)=>v+(y[i]-v)*t)); }
function тмЯркость(h){ const lin=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); };
  const [r,g,b]=тмRGB(h).map(lin); return 0.2126*r+0.7152*g+0.0722*b; }
/* контраст по WCAG 2: 4,5 — норма для текста, 3 — для крупного и значков */
function тмКонтраст(a,b){ const x=тмЯркость(a), y=тмЯркость(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
const тмЦвет=v=>/^#[0-9a-f]{6}$/i.test(String(v||''));

/* Проверка темы, пришедшей снаружи (код, файл, хранилище): только известные
   поля и только цвета вида #rrggbb — иначе в style попало бы что угодно. */
function тмОчистить(т){
  if(!т||typeof т!=='object') return null;
  const out={имя:String(т.имя||'Своя тема').replace(/[<>&"]/g,'').slice(0,40)||'Своя тема', тон:т.тон==='dark'?'dark':'light'};
  for(const k of ['фон','лист','текст','акцент','карандаш']){ if(!тмЦвет(т[k])) return null; out[k]=т[k].toLowerCase(); }
  if(тмЦвет(т.сцена)) out.сцена=т.сцена.toLowerCase();
  if(т.id&&/^[a-z0-9-]{1,40}$/i.test(т.id)) out.id=т.id;
  return out;
}

/* Все токены из пяти цветов. Пропорции подобраны по «Бумаге и графиту»:
   вторичный текст ~4,5:1 к листу, линии видны, но не спорят с текстом. */
function токеныТемы(т){
  const тём=т.тон==='dark', л=т.лист, ф=т.фон, к=т.текст, а=т.акцент;
  const сц=т.сцена||тмСмесь(л,тём?'#000000':'#ffffff',тём?0.12:0.35);
  const ц=ТЕМЫ_ЦВЕТА_ТОНА[тём?'dark':'light'];
  return {
    '--bg':ф, '--panel':л, '--panel-2':тмСмесь(л,ф,0.55), '--chrome':л, '--rail':тмСмесь(л,ф,0.4),
    '--well':тмСмесь(л,ф,0.35), '--ground':ф, '--canvas':сц, '--hero-bg':тмСмесь(л,ф,0.5),
    '--ink':к, '--ink-2':тмСмесь(к,л,0.28), '--ink-3':тмСмесь(к,л,0.44),
    '--line':тмСмесь(к,л,0.8), '--line-soft':тмСмесь(к,л,0.89), '--hair':тмСмесь(к,л,0.89),
    '--grid':тмСмесь(к,сц,0.91), '--grid-major':тмСмесь(к,сц,0.82), '--divider':к+'26',
    '--measure':т.карандаш, '--danger':ц.danger, '--second':ц.second, '--ok':ц.ok, '--third':ц.third,
    '--bar':л, '--bar-2':тмСмесь(л,ф,0.55), '--bar-ink':к, '--bar-ink-2':тмСмесь(к,л,0.28),
    '--bar-line':тмСмесь(к,л,0.8), '--bar-accent':а, '--f-app':а
  };
}
/* оттенки акцента — так же, как applySettings выводит их для своего цвета */
function токеныАкцента(а,тём){
  return {'--accent':а,'--accent-soft':а+(тём?'2e':'1f'),
    // текст и значки на заливке акцентом: белые на тёмном акценте, тёмные на светлом (жёлтый «Чертежа»)
    '--on-accent':тмКонтраст(а,'#ffffff')>=3?'#ffffff':'#14130f',
    '--accent-300':тём?тмСмесь(а,'#ffffff',.6):тмСмесь(а,'#000000',.22),
    '--accent-700':тём?тмСмесь(а,'#000000',.3):тмСмесь(а,'#ffffff',.2),
    '--accent-800':тём?тмСмесь(а,'#000000',.55):тмСмесь(а,'#ffffff',.78)};
}
let тмПоставлено=[];
/* Положить токены темы на <html> (или снять, если тема — CSS-палитра).
   свойАкцент — цвет, выбранный в «Акцентный цвет» поверх темы, или null. */
function применитьТокеныТемы(root,т,свойАкцент){
  for(const k of тмПоставлено) root.style.removeProperty(k);
  тмПоставлено=[];
  if(!т) return;
  const н=токеныТемы(т);
  if(!свойАкцент) Object.assign(н,токеныАкцента(т.акцент,т.тон==='dark'));
  for(const k in н){ root.style.setProperty(k,н[k]); тмПоставлено.push(k); }
}

/* ---- свои темы: хранятся отдельно от настроек ---- */
function моиТемы(){ let x=[]; try{ x=LS.get('myThemes',[]); }catch(_){} return (Array.isArray(x)?x:[]).map(тмОчистить).filter(Boolean); }
function сохранитьМоиТемы(список){ LS.set('myThemes',список.map(тмОчистить).filter(Boolean).slice(0,24)); }
/* карточка для галереи из темы движка */
function карточкаТемы(id,т){ return {id, имя:т.имя, theme:т.тон, palette:id.startsWith('my-')?'mine':id, seed:т,
  c:[т.фон,т.лист,т.текст,т.акцент,т.карандаш]}; }

/* Какая тема действует сейчас: с учётом расписания «день — ночь».
   Возвращает {theme, palette, seed} или null — тогда берутся сами настройки. */
function темаПоРасписанию(s){
  const р=s&&s.sched; if(!р||!р.вкл) return null;
  const ч=new Date().getHours(), с=+р.с, до=+р.до;
  const ночь = с===до ? false : с<до ? (ч>=с&&ч<до) : (ч>=с||ч<до);
  return разобратьИдТемы(ночь?р.ночь:р.день);
}
/* id карточки → тон, палитра и (для тем движка) сами цвета */
function разобратьИдТемы(id){
  if(!id) return null;
  if(ТЕМЫ_ДВИЖКА[id]) return {theme:ТЕМЫ_ДВИЖКА[id].тон,palette:id,seed:ТЕМЫ_ДВИЖКА[id]};
  if(/^my-/.test(id)){ const т=моиТемы().find(x=>x.id===id); return т?{theme:т.тон,palette:'mine',seed:т}:null; }
  const x=(typeof ТЕМЫ_ОФОРМЛЕНИЯ!=='undefined'?ТЕМЫ_ОФОРМЛЕНИЯ:[]).find(y=>y.id===id);
  return x?{theme:x.theme,palette:x.palette,seed:null}:null;
}
/* тема движка для текущих настроек (или null — палитра из CSS) */
function семяТемы(палитра,s){
  if(ТЕМЫ_ДВИЖКА[палитра]) return ТЕМЫ_ДВИЖКА[палитра];
  if(палитра==='mine') return тмОчистить(s&&s.mine);
  return null;
}

/* ---- обмен: код и файл ---- */
function кодТемы(т){ const ч=тмОчистить(т); delete ч.id; return 'PHYTHEME1:'+btoa(unescape(encodeURIComponent(JSON.stringify(ч)))); }
function темаИзКода(код){
  const s=String(код||'').replace(/\s+/g,'');
  let ч=null;
  const m=/PHYTHEME1:([A-Za-z0-9+/=]+)/.exec(s);
  if(m) ч=JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  else if(/^\{/.test(String(код).trim())) ч=JSON.parse(String(код));          // содержимое файла .physim-theme.json
  const т=тмОчистить(ч&&ч.тема?ч.тема:ч);
  if(!т) throw new Error('это не тема Phy.Sim');
  return т;
}

/* ---- смена темы: мягкий переход, где браузер умеет (View Transitions) ---- */
function сменитьТемуПлавно(сделать){
  const м=document.documentElement.dataset.motion;
  if(typeof document.startViewTransition==='function'&&м!=='off'&&м!=='calm'){
    try{ document.startViewTransition(()=>{ сделать(); }); return; }catch(_){}
  }
  сделать();
}

/* расписание проверяем раз в минуту: тема меняется сама, когда наступает вечер */
{ let было='';
  setInterval(()=>{ try{
    if(typeof S==='undefined'||!S.settings||!S.settings.sched||!S.settings.sched.вкл) return;
    const сейчас=JSON.stringify(темаПоРасписанию(S.settings)||{});
    if(сейчас!==было){ const первый=!было; было=сейчас; if(!первый) сменитьТемуПлавно(()=>applySettings()); }
  }catch(_){} },60000); }

/* ===================== КОНСТРУКТОР ТЕМЫ =====================
   Пять цветов и тон. Пока конструктор открыт, тема применяется вживую — всё
   пособие и сцена сразу перекрашиваются; «Отмена» возвращает как было.
   Под цветами — проверка контраста по WCAG: если текст на листе читается
   хуже 4,5:1, конструктор об этом говорит. */
const ТМ_ПОЛЯ=[
  ['фон','Фон','за листом, под полосами'],['лист','Лист','конспект и панели'],['текст','Текст','основной'],
  ['акцент','Акцент','выделение и кнопки'],['карандаш','Карандаш','размеры и измерения'],['сцена','Сцена','поле симуляции']];
function тмКHEX(v,запас){
  try{ const c=document.createElement('canvas').getContext('2d'); c.fillStyle='#010203'; c.fillStyle=String(v||'').trim();
    const x=c.fillStyle; if(/^#[0-9a-f]{6}$/i.test(x)&&x!=='#010203') return x; }catch(_){}
  return запас;
}
/* тема из того, что сейчас на экране: начало для новой своей темы */
function тмТекущая(){
  const ц=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const тём=document.documentElement.dataset.theme==='dark';
  return {имя:'Своя тема', тон:тём?'dark':'light', фон:тмКHEX(ц('--bg'),тём?'#0f0f0e':'#efede6'),
    лист:тмКHEX(ц('--panel'),тём?'#181816':'#fbfaf6'), текст:тмКHEX(ц('--ink'),тём?'#ebe8e0':'#1c1b18'),
    акцент:тмКHEX(ц('--accent'),тём?'#8ea4ff':'#2346c8'), карандаш:тмКHEX(ц('--measure'),тём?'#ee9a5a':'#b4561b'),
    сцена:тмКHEX(ц('--canvas'),тём?'#141413':'#fefdf9')};
}
function тмПроверка(т){
  const н=токеныТемы(т), строки=[
    ['Текст на листе',тмКонтраст(т.текст,т.лист),4.5],
    ['Второстепенный текст',тмКонтраст(н['--ink-3'],т.лист),4.5],
    ['Акцент на листе',тмКонтраст(т.акцент,т.лист),3],
    ['Карандаш на сцене',тмКонтраст(т.карандаш,н['--canvas']),3],
    ['Текст на фоне',тмКонтраст(т.текст,т.фон),4.5]];
  return строки.map(([и,к,нужно])=>`<span class="q-cr ${к>=нужно?'ok':'bad'}" title="нужно не меньше ${String(нужно).replace('.',',')}:1">${и} <b>${к.toFixed(1).replace('.',',')}:1</b> ${к>=нужно?'✓':'— мало'}</span>`).join('');
}
function подключитьКонструкторТем(body){
  const ed=body.querySelector('#q-ed'); if(!ed) return;
  let было=null, черн=null, правим=null;
  const снимок=()=>({theme:S.settings.theme,palette:S.settings.palette,mine:S.settings.mine});
  const живьём=()=>{ S.settings.theme=черн.тон; S.settings.palette='mine'; S.settings.mine=черн; applySettings();
    const п=ed.querySelector('#q-ed-check'); if(п) п.innerHTML=тмПроверка(черн); };
  const закрыть=(вернуть)=>{ if(вернуть&&было){ Object.assign(S.settings,было); applySettings(); }
    ed.classList.add('hidden'); ed.innerHTML=''; было=черн=правим=null; };
  const открыть=(т,id)=>{
    было=снимок(); черн=Object.assign({},т); правим=id||null;
    if(!черн.сцена) черн.сцена=тмСмесь(черн.лист,черн.тон==='dark'?'#000000':'#ffffff',черн.тон==='dark'?0.12:0.35);
    ed.innerHTML=`<div class="q-ed-head"><input id="q-ed-name" maxlength="40" value="${esc(черн.имя||'Своя тема')}" aria-label="Название темы">
        <div class="seg" id="q-ed-tone"><button data-v="light" class="${черн.тон==='light'?'on':''}">Светлая</button><button data-v="dark" class="${черн.тон==='dark'?'on':''}">Тёмная</button></div></div>
      <div class="q-ed-grid">${ТМ_ПОЛЯ.map(([k,и,п])=>`<label class="q-ed-c"><input type="color" data-k="${k}" value="${черн[k]}"><span><b>${и}</b><i>${п}</i></span></label>`).join('')}</div>
      <div class="q-ed-base"><span>Начать с:</span>${Object.keys(ТЕМЫ_ДВИЖКА).map(id=>`<button class="q-chip" data-base="${id}" style="--a:${ТЕМЫ_ДВИЖКА[id].лист};--b:${ТЕМЫ_ДВИЖКА[id].акцент}">${ТЕМЫ_ДВИЖКА[id].имя}</button>`).join('')}<button class="q-chip" data-base="__now">как сейчас</button></div>
      <div class="q-ed-check" id="q-ed-check"></div>
      <div class="q-act"><button class="btn primary" id="q-ed-save">Сохранить тему</button><button class="btn" id="q-ed-code">Код темы</button><button class="btn" id="q-ed-file">В файл</button>
        <button class="btn ghost" id="q-ed-x">Отмена</button></div>
      <div class="q-codebox hidden" id="q-ed-codebox"><textarea rows="2" spellcheck="false" readonly></textarea></div>`;
    ed.classList.remove('hidden'); живьём();
    ed.querySelectorAll('input[type=color]').forEach(i=>i.oninput=()=>{ черн[i.dataset.k]=i.value; живьём(); });
    ed.querySelector('#q-ed-name').oninput=e=>{ черн.имя=e.target.value; };
    ed.querySelectorAll('#q-ed-tone button').forEach(b=>b.onclick=()=>{ черн.тон=b.dataset.v;
      ed.querySelectorAll('#q-ed-tone button').forEach(x=>x.classList.toggle('on',x===b)); живьём(); });
    ed.querySelectorAll('[data-base]').forEach(b=>b.onclick=()=>{
      const осн=b.dataset.base==='__now'?Object.assign(тмТекущая(),было&&было.palette==='mine'&&было.mine?было.mine:{}):ТЕМЫ_ДВИЖКА[b.dataset.base];
      const имя=черн.имя; Object.assign(черн,осн,{имя}); if(!осн.сцена) черн.сцена=тмСмесь(черн.лист,черн.тон==='dark'?'#000000':'#ffffff',черн.тон==='dark'?0.12:0.35);
      const id=правим; открыть(черн,id); });
    ed.querySelector('#q-ed-x').onclick=()=>закрыть(true);
    ed.querySelector('#q-ed-save').onclick=()=>{
      const т=тмОчистить(Object.assign({},черн,{id:правим||('my-'+Date.now().toString(36))})); if(!т) return;
      const список=моиТемы().filter(x=>x.id!==т.id); список.push(т); сохранитьМоиТемы(список);
      S.settings.theme=т.тон; S.settings.palette='mine'; S.settings.mine=т; было=null;
      if(S.settings.sched&&S.settings.sched.вкл) S.settings.sched.вкл=false;
      applySettings(); renderPrefs(); renderPrefsSide(); toast(`Тема «${т.имя}» сохранена`); };
    ed.querySelector('#q-ed-code').onclick=()=>{ const к=ed.querySelector('#q-ed-codebox'); к.classList.remove('hidden');
      const ta=к.querySelector('textarea'); ta.value=кодТемы(черн); ta.select();
      try{ navigator.clipboard.writeText(ta.value).then(()=>toast('Код темы скопирован'),()=>{}); }catch(_){} };
    ed.querySelector('#q-ed-file').onclick=()=>{ const т=тмОчистить(черн); delete т.id;
      const blob=new Blob([JSON.stringify({формат:'physim-theme',версия:1,тема:т},null,2)],{type:'application/json'});
      сохранитьФайл((т.имя||'тема').replace(/[\\/:*?"<>|]+/g,'_')+'.physim-theme.json',blob); };
  };
  const нов=body.querySelector('#q-th-new'); if(нов) нов.onclick=()=>открыть(тмТекущая());
  body.querySelectorAll('[data-th-edit]').forEach(b=>b.onclick=e=>{ e.stopPropagation();
    const т=моиТемы().find(x=>x.id===b.dataset.thEdit); if(т) открыть(т,т.id); });
  body.querySelectorAll('[data-th-del]').forEach(b=>b.onclick=e=>{ e.stopPropagation();
    const т=моиТемы().find(x=>x.id===b.dataset.thDel); if(!т) return;
    askConfirm(`Удалить тему «${т.имя}»?`,()=>{ сохранитьМоиТемы(моиТемы().filter(x=>x.id!==т.id));
      if(S.settings.palette==='mine'&&S.settings.mine&&S.settings.mine.id===т.id){ S.settings.palette='std'; S.settings.theme=т.тон; S.settings.mine=null; applySettings(); }
      renderPrefs(); }); });
  const файл=body.querySelector('#q-th-file');
  if(файл) файл.onchange=()=>{ const f=файл.files&&файл.files[0]; if(!f) return;
    const r=new FileReader(); r.onload=()=>{ try{ принятьТему(темаИзКода(String(r.result))); }catch(e){ toast('Не получилось: '+e.message); } };
    r.readAsText(f); };
  // расписание «день — ночь»
  const вкл=body.querySelector('#q-sched-on');
  if(вкл) вкл.onchange=()=>{ const р=S.settings.sched=Object.assign({день:'light',ночь:'dark',с:21,до:7},S.settings.sched||{});
    р.вкл=вкл.checked; body.querySelector('.q-sched-row').classList.toggle('off',!р.вкл);
    body.querySelectorAll('[data-sched]').forEach(x=>{ р[x.dataset.sched]=/^(с|до)$/.test(x.dataset.sched)?+x.value:x.value; });
    сменитьТемуПлавно(()=>applySettings()); renderPrefsSide(); };
  body.querySelectorAll('[data-sched]').forEach(x=>x.onchange=()=>{ const р=S.settings.sched=Object.assign({день:'light',ночь:'dark',с:21,до:7},S.settings.sched||{});
    р[x.dataset.sched]=/^(с|до)$/.test(x.dataset.sched)?+x.value:x.value; if(р.вкл) сменитьТемуПлавно(()=>applySettings()); else LS.set('settings',S.settings); });
}
/* принять тему из кода или файла (кнопка «Вставить код» в профилях понимает и темы) */
function принятьТему(т){
  т=тмОчистить(Object.assign({},т,{id:'my-'+Date.now().toString(36)}));
  const список=моиТемы(); список.push(т); сохранитьМоиТемы(список);
  S.settings.theme=т.тон; S.settings.palette='mine'; S.settings.mine=т;
  applySettings(); renderPrefs(); renderPrefsSide(); toast(`Тема «${т.имя}» добавлена`);
}
