/* =====================================================================
   РАСКЛАДКА 7.0 ДЛЯ КОМПЬЮТЕРА: «СЦЕНА В ЦЕНТРЕ»
   =====================================================================
   До 7.0 компьютерный экран был устроен как среда разработки: колонка
   инструментов, дерево тем, конспект, сцена и полоса управления внизу —
   пять полос, и сцене доставалась треть ширины. Теперь сцена занимает
   всё окно, а остальное встаёт вокруг неё по делу:

     • сверху — «Раздел › Тема ▾» (список тем выпадает поверх сцены и
       закрывается, как только тема выбрана), рядом — выбор сцены темы;
       справа — поиск, «Конспект | Задачи», путь, вычислитель, настройки;
     • под сценой по центру — пульт, как у видеоплеера: шкала времени
       сверху, под ней карандаш с инструментами, шаги, пуск, скорость,
       масштаб и кнопка параметров. Он стоит под сценой, а не поверх неё:
       поверх он закрывал строку пояснений и числа нижней оси;
     • параметры и графики — карточка у правого края, убирается крестиком;
     • конспект и задачи выезжают справа и сдвигают сцену, а не закрывают её.

   Узлы не пересоздаются, а переставляются: у кнопок остаются те же id и те
   же обработчики, поэтому всё, что умел старый экран, умеет и новый.
   Включается только в компьютерном виде и только при настройке «Сцена в
   центре» (по умолчанию). Телефон устроен по эскизу автора и не меняется. */
const Р7={места:null, вкл:false};
function раскладка7(){ return document.documentElement.dataset.lay==='scene'; }
const иконка7={
  шеврон:'<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  карандаш:'<svg viewBox="0 0 24 24"><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/></svg>',
  ползунки:'<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  крест:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  шире:'<svg viewBox="0 0 24 24"><path d="M9 5H5v14h4M15 5h4v14h-4M8 12h8M10.5 9.5 8 12l2.5 2.5M13.5 9.5 16 12l-2.5 2.5"/></svg>',
  настройки:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/></svg>',
  конспект:'<svg viewBox="0 0 24 24"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M9 9h6M9 12.5h6M9 16h4"/></svg>',
  задачи:'<svg viewBox="0 0 24 24"><path d="M5 5h14v14H5z"/><path d="m8.5 12 2.4 2.4 4.6-5"/></svg>'
};
function кнопка7(id,кл,html,title){ const b=document.createElement('button'); b.id=id; b.className=кл; b.type='button';
  b.innerHTML=html; if(title) b.title=title; return b; }

/* Новые элементы создаются один раз; в классической раскладке они спрятаны стилем. */
function собрать7(){
  if(document.getElementById('d7-dock')) return;
  const tb=document.querySelector('.topbar'), бренд=document.getElementById('tbrand');
  // «Раздел › Тема ▾»
  const темы=кнопка7('d7-topics','d7-crumb',`<span class="d7-sec"></span><span class="d7-sl">›</span><b class="d7-t"></b>${иконка7.шеврон}`,'Список тем (B)');
  бренд.after(темы);
  // место для выбора сцены (сюда переезжает шапка симуляции)
  const сцены=document.createElement('div'); сцены.id='d7-simslot'; сцены.className='d7-simslot'; темы.after(сцены);
  // «Конспект | Задачи» и настройки — справа
  const пара=document.createElement('div'); пара.className='d7-seg'; пара.id='d7-seg';
  пара.append(кнопка7('d7-notes','d7-sb',`${иконка7.конспект}<span>Конспект</span>`,'Конспект темы'),
              кнопка7('d7-probs','d7-sb',`${иконка7.задачи}<span>Задачи</span><i class="d7-n" id="d7-np"></i>`,'Задачи темы'));
  const путь=document.getElementById('btn-path'); (путь&&путь.parentNode===tb?путь:document.getElementById('btn-cmdk')).before(пара);
  const наст=кнопка7('d7-settings','iconbtn d7-only',иконка7.настройки,'Настройки');
  document.getElementById('btn-simmenu').before(наст);
  // пульт под сценой
  const пульт=document.createElement('div'); пульт.id='d7-dock'; пульт.className='d7-dock';
  пульт.innerHTML=`<div class="d7-row d7-tlrow" id="d7-tlrow"></div>
    <div class="d7-row d7-ctl" id="d7-ctl"></div>`;
  const ctl=пульт.querySelector('#d7-ctl');
  ctl.append(кнопка7('d7-tools','iconbtn d7-tools',иконка7.карандаш,'Инструменты: карандаш, линейка, окружность, заметка…'));
  ctl.append(кнопка7('d7-params','iconbtn d7-pbtn',иконка7.ползунки,'Параметры и графики'));
  // колесо над пультом не должно масштабировать сцену
  пульт.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  document.getElementById('simpane').appendChild(пульт);
  // шапка карточки параметров
  const низ=document.getElementById('simbottom');
  const шп=document.createElement('div'); шп.className='d7-phead'; шп.id='d7-phead';
  шп.innerHTML='<b>Параметры</b><span class="spacer"></span>';
  шп.append(кнопка7('d7-pclose','iconbtn',иконка7.крест,'Убрать карточку — вернуть кнопкой на пульте'));
  низ.prepend(шп);
  // шапка выезжающего конспекта: шире / закрыть
  const ch=document.querySelector('#content .chead');
  const дх=document.createElement('div'); дх.className='d7-dh';
  дх.append(кнопка7('d7-wide','iconbtn',иконка7.шире,'Конспект во всю ширину — сцена уйдёт'),
            кнопка7('d7-close','iconbtn',иконка7.крест,'Закрыть конспект'));
  ch.prepend(дх);
  подключить7();
}

function подключить7(){
  const app=document.getElementById('app');
  document.getElementById('d7-topics').onclick=e=>{ e.stopPropagation();
    if(typeof закрытьГлавную==='function') закрытьГлавную();
    if(typeof путьОткрыт==='function'&&путьОткрыт()&&typeof закрытьПуть==='function') закрытьПуть();
    S.markMode=false; toggleSidebar(); };
  document.getElementById('d7-notes').onclick=()=>конспект7(!(app.classList.contains('d7-notes')&&S.tab==='notes'),'notes');
  document.getElementById('d7-probs').onclick=()=>конспект7(!(app.classList.contains('d7-notes')&&S.tab==='problems'),'problems');
  document.getElementById('d7-close').onclick=()=>конспект7(false);
  document.getElementById('d7-wide').onclick=()=>{ const sp=document.getElementById('simpane');
    if(!S.active&&sp.classList.contains('hidden')) return;
    document.getElementById('btn-simhide').click(); отметить7(); };
  document.getElementById('d7-settings').onclick=()=>document.getElementById('btn-settings').click();
  document.getElementById('d7-params').onclick=()=>параметры7(app.classList.contains('d7-nop'));
  document.getElementById('d7-pclose').onclick=()=>параметры7(false);
  document.getElementById('d7-tools').onclick=e=>{ e.stopPropagation(); инструменты7(); };
  // выбор инструмента закрывает веер; клик мимо — тоже
  document.getElementById('rail').addEventListener('click',e=>{
    if(!раскладка7()) return;
    if(e.target.closest('.tool,#btn-clear')) setTimeout(()=>инструменты7(false),0);
    setTimeout(отметить7,0);
  });
  document.addEventListener('pointerdown',e=>{
    if(!раскладка7()) return;
    const t=e.target;
    if(document.documentElement.classList.contains('d7-tools')&&!t.closest('#rail,#d7-tools,.pop,#penbar')) инструменты7(false);
    const sb=document.getElementById('sidebar');
    if(sb&&!sb.classList.contains('hidden')&&!t.closest('#sidebar,#d7-topics,#tab-marks,.pop,.modal-bg,.cmdk,.prefs')) toggleSidebar(true);
  },true);
  // закладки открывают тот же выпадающий список
  const закл=document.getElementById('tab-marks');
  if(закл) закл.addEventListener('click',()=>{ if(раскладка7()) toggleSidebar(false); });
  // вкладки конспекта: подсветка кнопок наверху
  document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>setTimeout(отметить7,0)));
  // разделитель тянет ширину конспекта (он справа от сцены)
  // — см. тянуть($('#splitter')) в app.js: там ветка для раскладки 7.0
}

/* ---- конспект и задачи ---- */
function конспект7(вкл,вкладка){
  const app=document.getElementById('app');
  if(вкл&&вкладка&&S.tab!==вкладка){ const b=document.querySelector(`#tabs button[data-tab="${вкладка}"]`); if(b) b.click(); }
  /* Сцены нет (введение, итоги) — конспект и есть страница: закрывать нечего. */
  const sp=document.getElementById('simpane');
  if(!вкл&&sp.classList.contains('hidden')){
    if(S.active){ document.getElementById('btn-simhide').click(); }
    else { отметить7(); return; }
  }
  app.classList.toggle('d7-notes',!!вкл);
  LS.set('d7Notes',!!вкл);
  if(вкл){ const s=document.getElementById('splitter'); if(s&&!sp.classList.contains('hidden')) s.classList.remove('hidden'); }
  ширинаКонспекта7(); отметить7();
  requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}
function ширинаКонспекта7(){
  const c=document.getElementById('content'); if(!c) return;
  const w=LS.get('d7NotesW',null);
  const по=Math.round(Math.min(620,Math.max(420,innerWidth*0.38)));
  c.style.setProperty('--d7-nw',Math.round(Math.max(380,Math.min(w||по,innerWidth-420)))+'px');
}
/* ---- карточка параметров ---- */
function параметры7(вкл){
  const app=document.getElementById('app');
  app.classList.toggle('d7-nop',!вкл); LS.set('d7Params',!!вкл); отметить7();
  requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
}
/* ---- веер инструментов над карандашом ---- */
function инструменты7(вкл){
  const root=document.documentElement;
  if(вкл===undefined) вкл=!root.classList.contains('d7-tools');
  root.classList.toggle('d7-tools',вкл);
  const рейка=document.getElementById('rail'), b=document.getElementById('d7-tools');
  if(вкл&&рейка&&b){
    const r=b.getBoundingClientRect();
    рейка.style.left=Math.max(8,Math.min(r.left-6,innerWidth-рейка.offsetWidth-8))+'px';
    рейка.style.bottom=Math.round(innerHeight-r.top+10)+'px';
  }
  отметить7();
}
/* ---- подсветка кнопок по состоянию ---- */
function отметить7(){
  const app=document.getElementById('app'); if(!app) return;
  const конс=app.classList.contains('d7-notes')||document.getElementById('simpane').classList.contains('hidden');
  const n=document.getElementById('d7-notes'), p=document.getElementById('d7-probs');
  if(n){ n.classList.toggle('on',конс&&S.tab!=='problems'); n.setAttribute('aria-pressed',String(конс&&S.tab!=='problems')); }
  if(p){ p.classList.toggle('on',конс&&S.tab==='problems'); p.setAttribute('aria-pressed',String(конс&&S.tab==='problems')); }
  app.classList.toggle('d7-nosim',!S.active);
  const пп=document.getElementById('d7-params'); if(пп) пп.classList.toggle('on',!app.classList.contains('d7-nop'));
  const ин=document.getElementById('d7-tools');
  if(ин) ин.classList.toggle('on',document.documentElement.classList.contains('d7-tools')||(S.tool&&S.tool!=='pan'));
  const t=S.topic, тм=document.getElementById('d7-topics');
  if(тм&&t){ тм.querySelector('.d7-sec').textContent=t.section||''; тм.querySelector('.d7-t').textContent=t.title; }
  const np=document.getElementById('d7-np'); if(np) np.textContent=t&&t.problems&&t.problems.length?t.problems.length:'';
  if(p) p.classList.toggle('hidden',!(t&&t.problems&&t.problems.length));
}

/* ---- перестановка узлов: туда и обратно ---- */
function переставить7(на){
  const st=document.querySelector('.statusbar'), tl=document.getElementById('timeline'), sh=document.querySelector('#simpane .simhead')||document.querySelector('.simhead');
  if(!st||!tl||!sh) return;
  if(!Р7.места) Р7.места={st:[st.parentNode,st.nextSibling], tl:[tl.parentNode,tl.nextSibling], sh:[sh.parentNode,sh.nextSibling]};
  const м=Р7.места;
  if(на){
    document.getElementById('d7-tlrow').appendChild(tl);
    const ctl=document.getElementById('d7-ctl'); ctl.insertBefore(st,document.getElementById('d7-params'));
    document.getElementById('simpane').appendChild(document.getElementById('d7-dock'));
    document.getElementById('d7-simslot').appendChild(sh);
  } else {
    м.st[0].insertBefore(st,м.st[1]); м.tl[0].insertBefore(tl,м.tl[1]); м.sh[0].insertBefore(sh,м.sh[1]);
  }
}

/* Включить или выключить раскладку по виду интерфейса и настройке. */
function обновитьРаскладку(){
  const root=document.documentElement;
  const надо=root.dataset.ui==='desktop'&&(typeof prefGet!=='function'||prefGet('deskLayout')!=='classic');
  root.dataset.lay=надо?'scene':'classic';
  if(!document.getElementById('d7-dock')) return;
  if(надо===Р7.вкл) { отметить7(); return; }
  Р7.вкл=надо;
  const app=document.getElementById('app');
  переставить7(надо);
  if(надо){
    app.classList.remove('mid');
    const sp=document.getElementById('simpane'); sp.style.flex=''; sp.style.width='';
    const низ=document.getElementById('simbottom'); if(низ){ низ.style.height=''; низ.classList.remove('collapsed'); }
    toggleSidebar(true);
    app.classList.toggle('d7-nop',LS.get('d7Params',true)===false);
    const сцены=!!S.active&&!sp.classList.contains('hidden');
    app.classList.toggle('d7-notes',!сцены||LS.get('d7Notes',false)===true);
    ширинаКонспекта7();
  } else {
    app.classList.remove('d7-notes','d7-nop'); root.classList.remove('d7-tools');
    const рейка=document.getElementById('rail'); if(рейка){ рейка.style.left=''; рейка.style.bottom=''; }
    if(!(typeof isNarrow==='function'&&isNarrow())&&innerWidth>=1200) toggleSidebar(false);
  }
  отметить7();
  requestAnimationFrame(()=>{ try{ resize(); if(typeof fitView==='function'&&A()) fitView(); }catch(_){} });
}

/* После выбора темы: список тем закрыть, подписи обновить; тема без сцены
   (введение, итоги раздела) открывается конспектом во всю ширину. */
(function(){
  const старая=window.openTopic;
  if(typeof старая!=='function') return;
  window.openTopic=function(id){
    const r=старая.apply(this,arguments);
    if(раскладка7()){
      toggleSidebar(true);
      const sp=document.getElementById('simpane'), app=document.getElementById('app');
      if(!S.active||sp.classList.contains('hidden')) app.classList.add('d7-notes');
      else app.classList.toggle('d7-notes',LS.get('d7Notes',false)===true);
      ширинаКонспекта7();
      requestAnimationFrame(()=>{ try{ resize(); }catch(_){} });
    }
    отметить7();
    return r;
  };
})();
addEventListener('resize',()=>{ if(раскладка7()) ширинаКонспекта7(); });
собрать7();
обновитьРаскладку();
