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
  const фк=(typeof ФАКТЫ!=='undefined'&&ФАКТЫ[t.id])||[];
  if(фк.length) сл.push({вид:'факты',h:'Интересные факты',
    html:фк.map(x=>`<div class="ls-fact"><b>${x.т}</b><p>${x.о}</p></div>`).join('')});
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
