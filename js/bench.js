/* =====================================================================
   РАСКЛАДКА 9.0 ДЛЯ КОМПЬЮТЕРА: «СТЕНД»
   =====================================================================
   Экран устроен как рабочий стол физика: слева раскрыт учебник, справа
   стоит прибор. Читать и крутить можно одновременно — в 8.0 конспект и
   параметры делили одну панель и переключались вкладками, и это мешало
   ровно в ту минуту, когда текст говорит «измените массу и посмотрите».

     • шапка — знак, «Содержание ▾» с текущей темой, поиск по курсу,
       «Мой путь», закладки, вычислитель, настройки;
     • содержание — дерево тем, выдвигается слева; на широком экране его
       можно оставить открытым, на узком оно ложится поверх и закрывается
       после выбора темы;
     • слева — конспект, справа — стенд: шапка с выбором сцены и
       инструментами в одну строку, сама сцена, под ней пульт (пуск, шаги,
       перемотка, скорость, масштаб), а ниже — дека в три колонки:
       параметры с ползунками, показания, графики. Показания больше не
       висят поверх рисунка.

   Тема без сцены (введение, итоги) открывается конспектом на всё окно.
   Узлы не пересоздаются, а переставляются: у кнопок остаются те же id и
   обработчики. «Колонки» в настройках возвращают всё на место. Телефон
   устроен по эскизу автора и меняет только облик. */
const С9={места:[], вкл:false};
function стенд(){ return document.documentElement.dataset.lay==='bench'; }
const знак9={
  шеврон:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  оглавление:'<svg viewBox="0 0 24 24"><path d="M4 6h3M4 12h3M4 18h3M10 6h10M10 12h10M10 18h10"/></svg>',
  крест:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function кн9(id,кл,html,title){ const b=document.createElement('button'); b.id=id; b.className=кл; b.type='button';
  b.innerHTML=html; if(title) b.title=title; return b; }

function собрать9(){
  if(document.getElementById('b9-toc')) return;
  const бренд=document.getElementById('tbrand');
  // «Содержание ▾» — раздел и тема
  const ог=кн9('b9-toc','b9-toc',`${знак9.оглавление}<span class="b9-sec"></span><b class="b9-t"></b>${знак9.шеврон}`,'Содержание курса (B)');
  бренд.after(ог);
  // пульт под сценой: сюда переезжает строка управления
  const пульт=document.createElement('div'); пульт.id='b9-deck'; пульт.className='b9-deck';
  пульт.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  const tl=document.getElementById('timeline'); tl.parentNode.insertBefore(пульт,tl);
  // шапка содержания — закрыть
  const sb=document.getElementById('sidebar');
  const шп=document.createElement('div'); шп.className='b9-tochead'; шп.id='b9-tochead';
  шп.innerHTML='<b>Содержание</b><span class="spacer"></span>';
  шп.append(кн9('b9-tocx','iconbtn',знак9.крест,'Закрыть содержание (B)'));
  sb.prepend(шп);
  подключить9();
}

function подключить9(){
  const содержание=()=>{ if(typeof закрытьГлавную==='function') закрытьГлавную();
    if(typeof путьОткрыт==='function'&&путьОткрыт()&&typeof закрытьПуть==='function') закрытьПуть();
    toggleSidebar(); LS.set('b9Toc',!document.getElementById('sidebar').classList.contains('hidden')); отметить9();
    requestAnimationFrame(()=>{ try{ resize(); }catch(_){} }); };
  document.getElementById('b9-toc').onclick=e=>{ e.stopPropagation(); содержание(); };
  document.getElementById('b9-tocx').onclick=()=>{ toggleSidebar(true); LS.set('b9Toc',false); отметить9(); requestAnimationFrame(()=>{ try{ resize(); }catch(_){} }); };
  // на узком экране содержание лежит поверх: щелчок мимо закрывает
  document.addEventListener('pointerdown',e=>{
    if(!стенд()||!поверх9()) return; const sb=document.getElementById('sidebar');
    if(sb&&!sb.classList.contains('hidden')&&!e.target.closest('#sidebar,#b9-toc,#tab-marks,#tab-topics,.pop,.modal-bg,.cmdk,.prefs')){ toggleSidebar(true); отметить9(); }
  },true);
  const закл=document.getElementById('tab-marks');
  if(закл) закл.addEventListener('click',()=>{ if(стенд()){ toggleSidebar(false); отметить9(); } });
  const курс=document.getElementById('tab-topics');
  if(курс) курс.addEventListener('click',()=>{ if(стенд()){ toggleSidebar(false); отметить9(); } });
  document.getElementById('rail').addEventListener('click',()=>{ if(стенд()) setTimeout(отметить9,0); });
}
/* содержание поверх конспекта, а не рядом: окно уже 1600 px — иначе
   стенду остаётся меньше половины экрана */
function поверх9(){ return innerWidth<1600; }

function ширина9(){
  const c=document.getElementById('content'); if(!c) return;
  const w=LS.get('b9NotesW',null), по=Math.round(clamp(innerWidth*0.36,380,640));
  c.style.setProperty('--b9-nw',Math.round(clamp(w||по,340,Math.max(340,innerWidth-560)))+'px');
}

function отметить9(){
  const app=document.getElementById('app'); if(!app||!document.getElementById('b9-toc')) return;
  const sp=document.getElementById('simpane');
  app.classList.toggle('b9-read',!S.active||sp.classList.contains('hidden'));
  app.classList.toggle('b9-over',поверх9());
  /* узкий стенд: три колонки деки не помещаются — она становится одной
     прокручиваемой лентой (параметры, показания, графики друг под другом) */
  const ш=sp.getBoundingClientRect().width;
  if(ш>0) app.classList.toggle('b9-tight',ш<860);
  const t=S.topic, ог=document.getElementById('b9-toc');
  if(ог&&t){ const sec=typeof разделТемы==='function'?разделТемы(t):null;
    ог.querySelector('.b9-sec').textContent=sec?sec.title:(t.section||'');
    ог.querySelector('.b9-t').textContent=(t.ch&&t.kind!=='recap'?t.ch+' · ':'')+t.title; }
  const видно=!document.getElementById('sidebar').classList.contains('hidden');
  if(ог){ ог.classList.toggle('on',видно); ог.setAttribute('aria-expanded',String(видно)); }
}

/* ---- перестановка узлов: туда и обратно ---- */
function переставить9(на){
  if(на){
    const взять=(el,куда,перед)=>{ if(!el||!куда) return; С9.места.push([el,el.parentNode,el.nextSibling]);
      куда.insertBefore(el,перед||null); };
    const tb=document.querySelector('.topbar'), меню=document.getElementById('btn-simmenu');
    взять(document.getElementById('btn-settings'),tb,меню);
    const sh=document.querySelector('#simpane .simhead');
    взять(document.getElementById('rail'),sh,document.getElementById('clock'));
    const пульт=document.getElementById('b9-deck');
    взять(document.querySelector('.statusbar'),пульт,null);
    взять(document.getElementById('timeline'),пульт,null);
    const низ=document.getElementById('simbottom');
    взять(document.getElementById('hud'),низ,document.getElementById('gbox'));
  } else {
    while(С9.места.length){ const [el,родитель,след]=С9.места.pop(); родитель.insertBefore(el,след&&след.parentNode===родитель?след:null); }
  }
}

/* Включить или выключить раскладку по виду интерфейса и настройке. */
function обновитьРаскладку(){
  const root=document.documentElement;
  const надо=root.dataset.ui==='desktop'&&(typeof prefGet!=='function'||prefGet('deskLayout')!=='classic');
  root.dataset.lay=надо?'bench':'classic';
  if(!document.getElementById('b9-toc')) return;
  if(надо===С9.вкл){ отметить9(); return; }
  С9.вкл=надо;
  const app=document.getElementById('app');
  переставить9(надо);
  if(надо){
    app.classList.remove('mid');
    const sp=document.getElementById('simpane'); sp.style.flex=''; sp.style.width='';
    const низ=document.getElementById('simbottom'); if(низ){ низ.classList.remove('collapsed'); }
    toggleSidebar(поверх9()||LS.get('b9Toc',innerWidth>=1600)===false);
    const hud=document.getElementById('hud'); if(hud){ hud.style.left=''; hud.style.top=''; hud.style.width=''; hud.style.height=''; }
    ширина9();
  } else {
    app.classList.remove('b9-read','b9-over');
    if(!(typeof isNarrow==='function'&&isNarrow())&&innerWidth>=1200) toggleSidebar(false);
  }
  отметить9();
  try{ if(typeof renderParams==='function'&&A()) renderParams(); }catch(_){}
  requestAnimationFrame(()=>{ try{ resize(); if(typeof fitView==='function'&&A()) fitView(); }catch(_){} });
}

/* После выбора темы: содержание закрыть, если оно лежит поверх; подписи
   обновить. Тема без сцены открывается конспектом на всё окно. */
(function(){
  const старая=window.openTopic;
  if(typeof старая!=='function') return;
  window.openTopic=function(id){
    const r=старая.apply(this,arguments);
    if(стенд()){
      if(поверх9()) toggleSidebar(true);
      else toggleSidebar(LS.get('b9Toc',innerWidth>=1600)===false);
      ширина9();
      requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
    }
    отметить9();
    return r;
  };
  const сцена=window.openSim;
  if(typeof сцена==='function') window.openSim=function(){ const r=сцена.apply(this,arguments); отметить9(); return r; };
})();
addEventListener('resize',()=>{ if(стенд()){ ширина9(); отметить9(); } });
/* разделитель меняет ширину стенда без события resize */
if(window.ResizeObserver) try{ new ResizeObserver(()=>{ if(стенд()) отметить9(); }).observe(document.getElementById('simpane')); }catch(_){}
собрать9();
обновитьРаскладку();
