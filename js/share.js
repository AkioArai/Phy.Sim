/* ===================== ССЫЛКА НА ОПЫТ (6.1.0) =====================
   Учитель настроил симуляцию — угол, массу, скорость — и хочет, чтобы
   ученики открыли ровно её. «Ссылка на этот опыт» в меню «Ещё» собирает
   адрес вида  …/Phy.Sim/#sim=proj2d&topic=mech.2d&a01=60&v01=30 :
   в нём только параметры, отличные от исходных. Открыв ссылку, пособие
   само переходит к теме, открывает симуляцию и выставляет параметры.
   В приложении для телефона и компьютера своего адреса нет, поэтому там
   ссылка ведёт на сайт пособия. */
const САЙТ_ПОСОБИЯ='https://akioarai.github.io/Phy.Sim/';
// запоминаем сразу: разбор ссылки потом стирает её из адреса
const ПО_ССЫЛКЕ=/(^#|&)sim=/.test(location.hash||'');

function ссылкаНаОпыт(){
  const a=A(); if(!a||!S.active) return null;
  const ч=[];
  for(const p of a.def.params){
    if(p.type==='group'||p.key===undefined) continue;
    const v=a.params[p.key];
    if(p.default!==undefined&&String(v)===String(p.default)) continue;
    ч.push(encodeURIComponent(p.key)+'='+encodeURIComponent(typeof v==='boolean'?(v?'1':'0'):String(v)));
  }
  const база=/^https?:$/.test(location.protocol)?location.origin+location.pathname:САЙТ_ПОСОБИЯ;
  const тема=S.topic&&S.topic.id;
  return база+'#sim='+encodeURIComponent(S.active)+(тема?'&topic='+encodeURIComponent(тема):'')+(ч.length?'&'+ч.join('&'):'');
}

async function поделитьсяОпытом(){
  const url=ссылкаНаОпыт(); if(!url){ toast('Сначала откройте симуляцию'); return; }
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ await navigator.clipboard.writeText(url); toast('Ссылка на опыт скопирована'); return; } }catch(_){}
  try{ if(navigator.share){ await navigator.share({title:'Phy.Sim',url}); return; } }catch(_){ return; }
  window.prompt('Ссылка на опыт — скопируйте её:',url);
}

/* Открыть опыт по ссылке. Неизвестные ключи и значения вне диапазона
   молча отбрасываются: ссылку могли набрать руками или от старой версии. */
function открытьОпытИзСсылки(){
  const h=String(location.hash||'').replace(/^#/,''); if(!/(^|&)sim=/.test(h)) return false;
  const q={}; for(const кус of h.split('&')){ const i=кус.indexOf('='); if(i<1) continue;
    try{ q[decodeURIComponent(кус.slice(0,i))]=decodeURIComponent(кус.slice(i+1)); }catch(_){} }
  const id=q.sim; if(!id||!SIMS[id]) return false;
  const связано=t=>[...(t.formulas||[]),...(t.problems||[]),...(t.explore||[])].some(x=>x.sim===id);
  const тема=(q.topic&&ALL.find(t=>t.id===q.topic))||ALL.find(связано);
  if(typeof закрытьГлавную==='function') закрытьГлавную();
  if(тема) openTopic(тема.id);
  openSim(id);
  const a=A(); if(!a) return false;
  for(const p of a.def.params){
    if(p.type==='group'||!(p.key in q)) continue;
    const s=q[p.key];
    if(p.type==='check') a.params[p.key]=s==='1'||s==='true';
    else if(p.type==='select'){ const o=(p.options||[]).find(o=>String(o.v)===s); if(o) a.params[p.key]=o.v; }
    else { const v=parseFloat(s); if(isFinite(v)) a.params[p.key]=clamp(v,p.min,p.max); }
  }
  restart(a); fitView(); try{ pushUndo(a); }catch(_){}
  renderParams(); try{ buildGraphs(); }catch(_){}
  if(typeof isNarrow==='function'&&isNarrow()) openSimMobile();
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(_){}
  toast('Открыт опыт по ссылке');
  return true;
}
