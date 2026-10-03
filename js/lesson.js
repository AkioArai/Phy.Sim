/* ===================== РЕЖИМ УРОКА (4.0.0) =====================
   Тема как презентация: конспект разрезан на слайды по подзаголовкам,
   крупный текст слева, живая сцена справа остаётся на месте. Учителю — для
   проектора, ученику — чтобы пройти тему по шагам, не утонув в длинной
   странице. Слайды собираются из тех же полей темы, что и конспект, поэтому
   отдельно их писать не нужно.
   Клавиши: → / пробел / PgDn — дальше, ← / PgUp — назад, Home / End, Esc — выход. */
const УРОК={слайды:[],i:0,вкл:false};
const _УРОК_ДЛИНА=900;   // знаков на слайде, дальше режем по абзацам

function слайдыТемы(t){
  const сл=[];
  const sec=SECTIONS.find(s=>s.topics.some(x=>x.id===t.id));
  сл.push({вид:'титул',html:`<div class="ls-eye">${esc(sec?sec.title:'')}${t.ch?` · глава ${esc(t.ch)}`:''}</div>
    <h1 class="ls-title">${esc(t.title)}</h1>${t.why?`<div class="ls-why">${t.why}</div>`:''}`});
  if(t.key&&t.key.length) сл.push({вид:'главное',h:'Главное',html:`<ul class="ls-key">${t.key.map(k=>`<li>${k}</li>`).join('')}</ul>`});
  // подробный разбор — по подзаголовкам h3; кусок без заголовка в начале — «Введение»
  if(t.theory){
    const d=document.createElement('div'); d.innerHTML=t.theory;
    let тек={h:'Введение',узлы:[]}; const куски=[тек];
    for(const n of Array.from(d.childNodes)){
      if(n.nodeType===1&&/^H[34]$/.test(n.tagName)){ тек={h:n.textContent.trim(),узлы:[]}; куски.push(тек); }
      else if(n.nodeType===1||(n.nodeType===3&&n.nodeValue.trim())) тек.узлы.push(n);
    }
    for(const к of куски){
      if(!к.узлы.length) continue;
      // длинный кусок режем по абзацам, чтобы влез в слайд без прокрутки
      let порция=[], длина=0, часть=0;
      const сдать=()=>{ if(!порция.length) return;
        сл.push({вид:'текст',h:к.h+(часть?' (продолжение)':''),html:порция.map(n=>n.nodeType===1?n.outerHTML:`<p>${n.nodeValue}</p>`).join('')});
        порция=[]; длина=0; часть++; };
      for(const n of к.узлы){
        const L=(n.textContent||'').length;
        if(длина&&длина+L>_УРОК_ДЛИНА) сдать();
        порция.push(n); длина+=L;
      }
      сдать();
    }
  }
  const опыт=(t.explore||[]).find(e=>e.sim&&SIMS[e.sim]);
  if(t.explore&&t.explore.length) сл.push({вид:'опыт',h:'Покрутите сами',sim:опыт&&опыт.sim,
    html:`<p class="ls-lead">Сначала скажите, что произойдёт, — потом проверьте на модели справа.</p>
      <ol class="ls-exp">${t.explore.map(e=>`<li><span class="exl-do">${e.do}</span><span class="exl-see">${e.see}</span>
        <button class="btn ls-rev">Показать, что будет</button></li>`).join('')}</ol>`});
  const ф=t.formulas||[];
  for(let k=0;k<ф.length;k+=3) сл.push({вид:'формулы',h:'Основные формулы'+(k?' (продолжение)':''),sim:ф[k].sim,
    html:ф.slice(k,k+3).map(f=>`<div class="ls-f"><div>$$${f.tex}$$</div>${f.note?`<div class="ls-fn">${f.note}</div>`:''}</div>`).join('')});
  if(t.mistakes&&t.mistakes.length) сл.push({вид:'ошибки',h:'Типичные ошибки',
    html:t.mistakes.slice(0,3).map(m=>`<div class="ls-pf"><div class="bad"><span>так думают</span>${m.wrong}</div><div class="good"><span>на самом деле</span>${m.right}</div></div>`).join('')});
  for(const q of (t.checks||[]).slice(0,4)) сл.push({вид:'вопрос',h:'Проверьте себя',
    html:`<div class="ls-q">${q.q}</div><button class="btn primary ls-rev">Показать ответ</button><div class="ls-a">${q.a}</div>`});
  сл.push({вид:'конец',h:'Тема пройдена',html:`<p class="ls-lead">Закрепить — задачами: ответ в них пересчитывается под параметры модели.</p>
    <div class="ls-end">${(t.problems||[]).length?`<button class="btn primary" data-ls="problems">Перейти к задачам · ${t.problems.length}</button>`:''}
      <button class="btn" data-ls="exit">Выйти из урока</button></div>`});
  return сл;
}

function начатьУрок(){
  const t=S.topic;
  if(!t||t.kind==='recap'||t.id==='intro'){ toast('Откройте тему — урок собирается из её конспекта'); return; }
  УРОК.слайды=слайдыТемы(t); УРОК.i=0; УРОК.вкл=true; УРОК.тема=t.id;
  let el=document.getElementById('lesson');
  if(!el){ el=document.createElement('div'); el.id='lesson'; el.className='lesson';
    el.setAttribute('role','region'); el.setAttribute('aria-label','Урок'); el.setAttribute('aria-live','polite');
  }
  // на телефоне урок — поверх всего, и лист снизу не должен его перекрывать:
  // внутри #content у фиксированного слоя свой контекст наложения
  const родитель=isNarrow()?document.body:document.getElementById('content');
  if(el.parentNode!==родитель) родитель.appendChild(el);
  // карточки поверх конспекта уроку только мешают
  if(typeof закрытьПриём==='function') закрытьПриём();
  if(typeof закрытьТермин==='function') закрытьТермин();
  document.documentElement.dataset.lesson='on';
  остановитьЧтение();
  слайдУрока(0);
  setTimeout(()=>dispatchEvent(new Event('resize')),30);
}
function закончитьУрок(){
  if(!УРОК.вкл) return;
  УРОК.вкл=false; delete document.documentElement.dataset.lesson;
  const el=document.getElementById('lesson'); if(el) el.innerHTML='';
  setTimeout(()=>dispatchEvent(new Event('resize')),30);
}
function слайдУрока(i){
  const сл=УРОК.слайды, el=document.getElementById('lesson'); if(!el||!сл.length) return;
  i=Math.max(0,Math.min(сл.length-1,i)); УРОК.i=i;
  const s=сл[i];
  el.innerHTML=`<div class="ls-top"><span class="ls-n">${i+1} / ${сл.length}</span>
      <div class="ls-bar"><i style="width:${Math.round(100*(i+1)/сл.length)}%"></i></div>
      <button class="iconbtn ls-x" title="Выйти из урока (Esc)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <article class="ls-slide ls-${s.вид}">${s.h?`<h2 class="ls-h">${esc(s.h)}</h2>`:''}${s.html}</article>
    <div class="ls-nav"><button class="btn ls-prev"${i?'':' disabled'}>← Назад</button>
      <span class="ls-hint">← → или пробел</span>
      <button class="btn primary ls-next"${i<сл.length-1?'':' disabled'}>Дальше →</button></div>`;
  const art=el.querySelector('.ls-slide');
  typeset(art);
  if(typeof разметитьТермины==='function') try{ разметитьТермины(art,УРОК.тема); }catch(_){}
  el.querySelector('.ls-x').onclick=закончитьУрок;
  el.querySelector('.ls-prev').onclick=()=>слайдУрока(УРОК.i-1);
  el.querySelector('.ls-next').onclick=()=>слайдУрока(УРОК.i+1);
  el.querySelectorAll('.ls-rev').forEach(b=>b.onclick=()=>{ b.parentElement.classList.add('shown'); b.remove(); });
  el.querySelectorAll('[data-ls]').forEach(b=>b.onclick=()=>{
    const что=b.dataset.ls; закончитьУрок();
    if(что==='problems'){ const tb=document.querySelector('#tabs button[data-tab="problems"]'); if(tb) tb.click(); } });
  // слайд с опытом или формулами своей модели — открываем её на сцене
  if(s.sim&&SIMS[s.sim]&&(!S.sim||S.sim.id!==s.sim)) try{ openSim(s.sim); }catch(_){}
  art.scrollTop=0;
}
addEventListener('keydown',e=>{
  if(!УРОК.вкл) return;
  const цель=e.target; if(цель&&(цель.tagName==='INPUT'||цель.tagName==='TEXTAREA'||цель.isContentEditable)) return;
  const к=e.key; let ход=0;
  if(к==='ArrowRight'||к==='PageDown'||(к===' '&&!e.shiftKey)) ход=1;
  else if(к==='ArrowLeft'||к==='PageUp'||(к===' '&&e.shiftKey)) ход=-1;
  else if(к==='Home'){ e.preventDefault(); e.stopPropagation(); слайдУрока(0); return; }
  else if(к==='End'){ e.preventDefault(); e.stopPropagation(); слайдУрока(УРОК.слайды.length-1); return; }
  else if(к==='Escape'){ e.preventDefault(); e.stopPropagation(); закончитьУрок(); return; }
  if(ход){ e.preventDefault(); e.stopPropagation(); слайдУрока(УРОК.i+ход); }
},true);
// свайп по слайду на телефоне
(function(){ let x0=null,y0=0;
  addEventListener('touchstart',e=>{ if(!УРОК.вкл||!e.target.closest||!e.target.closest('#lesson')) return; x0=e.touches[0].clientX; y0=e.touches[0].clientY; },{passive:true});
  addEventListener('touchend',e=>{ if(x0===null) return; const t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
    if(Math.abs(dx)>60&&Math.abs(dx)>1.5*Math.abs(dy)) слайдУрока(УРОК.i+(dx<0?1:-1)); },{passive:true});
})();

/* ===================== «СНАЧАЛА ПРЕДСКАЖИТЕ» (4.0.0) =====================
   Опыт, результат которого написан рядом, ничего не проверяет: глаз
   прочитал ответ раньше, чем рука подвинула ползунок. С включённой
   настройкой результат в «Покрутите сами» скрыт, пока вы не сделаете
   прогноз. Ничего не засчитывается и не хранится — это для головы. */
function подключитьПрогноз(pane){
  if(typeof prefGet!=='function'||!prefGet('predict')) return;
  pane.querySelectorAll('.explore .ex-list li').forEach(li=>{
    if(li.querySelector('.exl-rev')) return;
    li.classList.add('predict');
    const b=document.createElement('button'); b.className='exl-rev';
    b.textContent='Мой прогноз готов — показать';
    b.onclick=()=>{ li.classList.remove('predict'); b.remove(); };
    li.appendChild(b);
  });
}

/* ===================== ЧТЕНИЕ ВСЛУХ (4.0.0) =====================
   Встроенный синтезатор речи браузера, русский голос, если он есть.
   Формулы не проговариваются (синтезатор читает TeX как кашу) — на их месте
   короткая пауза со словом «формула». Читается то, что сейчас в конспекте,
   абзац за абзацем; уже прочитанный абзац подсвечивается. */
const ЧТЕНИЕ={вкл:false,очередь:[],узел:null};
function чтениеДоступно(){ return typeof speechSynthesis!=='undefined'&&typeof SpeechSynthesisUtterance!=='undefined'; }
function текстДляЧтения(el){
  const c=el.cloneNode(true);
  c.querySelectorAll('.katex-display').forEach(k=>k.replaceWith(document.createTextNode(' Формула. ')));
  c.querySelectorAll('.katex').forEach(k=>k.replaceWith(document.createTextNode(' формула ')));
  c.querySelectorAll('button,.op-chip,.f-kind,.exl-rev').forEach(k=>k.remove());
  return c.textContent.replace(/\s+/g,' ').trim();
}
function читатьВслух(){
  if(!чтениеДоступно()){ toast('Этот браузер не умеет читать вслух'); return; }
  if(ЧТЕНИЕ.вкл){ остановитьЧтение(); return; }
  const корень=УРОК.вкл?document.querySelector('#lesson .ls-slide'):document.querySelector('#pane article');
  if(!корень){ toast('Откройте конспект темы — читать пока нечего'); return; }
  // в конспекте раскрываем подробный разбор: читать то, чего не видно, странно
  const дет=корень.querySelector('details.deep'); if(дет) дет.open=true;
  const блоки=Array.from(корень.querySelectorAll('h1,h2,h3,p,li,.why>div:last-child,.note,.qa-q,.pf-row,.ls-q'))
    .filter(b=>!b.closest('.qa-a,.ex-body,.deriv')&&!b.querySelector('p,li')&&b.offsetParent!==null);
  ЧТЕНИЕ.очередь=блоки.map(b=>({b,т:текстДляЧтения(b)})).filter(x=>x.т.length>1);
  if(!ЧТЕНИЕ.очередь.length){ toast('Здесь нечего читать вслух'); return; }
  ЧТЕНИЕ.вкл=true; кнопкаЧтения(); speechSynthesis.cancel(); следующийАбзац();
}
function голосРу(){
  const г=speechSynthesis.getVoices();
  return г.find(v=>/^ru/i.test(v.lang)&&/google|natural|милена|milena/i.test(v.name))||г.find(v=>/^ru/i.test(v.lang))||null;
}
function следующийАбзац(){
  if(ЧТЕНИЕ.узел) ЧТЕНИЕ.узел.classList.remove('reading-now');
  const x=ЧТЕНИЕ.очередь.shift();
  if(!ЧТЕНИЕ.вкл||!x){ остановитьЧтение(); return; }
  ЧТЕНИЕ.узел=x.b; x.b.classList.add('reading-now');
  try{ x.b.scrollIntoView({block:'center',behavior:'smooth'}); }catch(_){}
  const u=new SpeechSynthesisUtterance(x.т); u.lang='ru-RU';
  const г=голосРу(); if(г) u.voice=г;
  u.rate=1; u.onend=следующийАбзац; u.onerror=()=>{ if(ЧТЕНИЕ.вкл) следующийАбзац(); };
  speechSynthesis.speak(u);
}
function остановитьЧтение(){
  ЧТЕНИЕ.вкл=false; ЧТЕНИЕ.очередь=[];
  if(ЧТЕНИЕ.узел){ ЧТЕНИЕ.узел.classList.remove('reading-now'); ЧТЕНИЕ.узел=null; }
  if(чтениеДоступно()) try{ speechSynthesis.cancel(); }catch(_){}
  кнопкаЧтения();
}
function кнопкаЧтения(){
  const b=document.getElementById('t-speak'); if(!b) return;
  b.classList.toggle('on',ЧТЕНИЕ.вкл); b.title=ЧТЕНИЕ.вкл?'Остановить чтение':'Прочитать конспект вслух';
}
/* кнопки в шапке темы: «Урок» и «Вслух» */
function подключитьДействияТемы(){
  const ch=document.querySelector('#content .chead'); if(!ch||document.getElementById('t-acts')) return;
  const d=document.createElement('div'); d.className='t-acts'; d.id='t-acts';
  d.innerHTML=`<button class="tact" id="t-lesson" title="Режим урока: тема слайдами рядом со сценой"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M10 8l4 2-4 2z"/></svg><span>Урок</span></button>
    ${чтениеДоступно()?`<button class="tact" id="t-speak" title="Прочитать конспект вслух"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg><span>Вслух</span></button>`:''}`;
  ch.appendChild(d);
  d.querySelector('#t-lesson').onclick=()=>начатьУрок();
  const sp=d.querySelector('#t-speak'); if(sp) sp.onclick=()=>читатьВслух();
}
/* На телефоне шапка темы скрыта под листом — те же две кнопки ставим
   первой строкой конспекта. */
function кнопкиВКонспект(pane){
  const a=pane&&pane.querySelector('article'); if(!a||a.querySelector('.m-acts')) return;
  const d=document.createElement('div'); d.className='m-acts';
  d.innerHTML=`<button class="tact" data-a="lesson"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M10 8l4 2-4 2z"/></svg><span>Урок по слайдам</span></button>`
    +(чтениеДоступно()?`<button class="tact" data-a="speak"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg><span>Слушать</span></button>`:'');
  a.insertBefore(d,a.firstChild);
  d.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ if(b.dataset.a==='lesson') начатьУрок(); else читатьВслух(); });
}
