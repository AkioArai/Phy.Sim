'use strict';
/* ===================== НОВЫЙ ГОД (10.3) =====================
   Тема «Новый год» (themes.js) — цвета. Здесь — украшения, которые
   не должны нагружать устройство:
   · снег только на главной, за карточками: до 70 снежинок, 30 кадров в
     секунду, цикл стоит, когда главная закрыта или вкладка не видна;
     при спокойной анимации снег рисуется один раз и не движется;
   · гирлянда под верхней панелью и шапка на логотипе — чистый CSS
     ([data-ptheme="newyear"] в style.css).
   Сцены физики не трогаем: снег поверх опыта мешал бы смотреть. */
const НГ={cv:null,живёт:false,хлопья:[],W:0,H:0,прошлое:0};
function новыйГодВключён(){ return document.documentElement.dataset.ptheme==='newyear'; }
function снегГлавной(){
  const h=document.getElementById('home');
  if(!h||!новыйГодВключён()||h.classList.contains('hidden')){ if(НГ.cv) НГ.cv.remove(); НГ.cv=null; return; }
  if(!НГ.cv||!h.contains(НГ.cv)){
    НГ.cv=document.createElement('canvas'); НГ.cv.className='ny-snow'; НГ.cv.setAttribute('aria-hidden','true');
    h.prepend(НГ.cv); НГ.хлопья=[]; НГ.W=0;
  }
  if(!НГ.живёт){ НГ.живёт=true; НГ.прошлое=performance.now(); requestAnimationFrame(кадрСнега); }
}
function размерСнега(){
  /* холст «прилипает» к верху прокрутки главной и занимает ровно её окно:
     высота задаётся числом, а отрицательный нижний отступ того же размера
     кладёт карточки поверх снега, не сдвигая их */
  const cv=НГ.cv, дом=cv.parentNode, w=дом.clientWidth, h=дом.clientHeight; if(!w||!h) return false;
  if(cv.style.height!==h+'px'){ cv.style.height=h+'px'; cv.style.marginBottom=(-h)+'px'; }
  if(w!==НГ.W||h!==НГ.H){
    НГ.W=w; НГ.H=h; const dpr=Math.min(devicePixelRatio||1,1.5); cv.width=Math.round(w*dpr); cv.height=Math.round(h*dpr);
    const n=Math.min(70,Math.max(30,Math.round(w*h/16000)));
    while(НГ.хлопья.length<n) НГ.хлопья.push(новаяСнежинка(true));
    НГ.хлопья.length=n;
  }
  return true;
}
function новаяСнежинка(где){ return {x:Math.random()*(НГ.W||1000), y:где?Math.random()*(НГ.H||800):-6,
  r:1+Math.random()*1.8, v:14+Math.random()*30, ф:Math.random()*6.28, а:0.45+Math.random()*0.45}; }
function кадрСнега(now){
  const cv=НГ.cv, h=document.getElementById('home');
  if(!cv||!h||h.classList.contains('hidden')||!новыйГодВключён()){ НГ.живёт=false; if(cv&&!новыйГодВключён()){ cv.remove(); НГ.cv=null; } return; }
  const тихо=document.documentElement.dataset.motion!=='full';
  if(document.visibilityState==='visible'&&now-НГ.прошлое>=32&&размерСнега()){
    const dt=Math.min(0.05,(now-НГ.прошлое)/1000); НГ.прошлое=now;
    const ctx=cv.getContext('2d'), k=cv.width/НГ.W;
    ctx.setTransform(k,0,0,k,0,0); ctx.clearRect(0,0,НГ.W,НГ.H);
    ctx.fillStyle='#ffffff';
    for(const с of НГ.хлопья){
      if(!тихо){ с.y+=с.v*dt; с.ф+=dt*0.8; с.x+=Math.sin(с.ф)*8*dt;
        if(с.y>НГ.H+4){ Object.assign(с,новаяСнежинка(false)); с.x=Math.random()*НГ.W; } }
      ctx.globalAlpha=с.а; ctx.beginPath(); ctx.arc(с.x,с.y,с.r,0,6.283); ctx.fill();
    }
    ctx.globalAlpha=1;
    if(тихо){ НГ.живёт=false; return; }   // спокойный режим: один кадр
  }
  requestAnimationFrame(кадрСнега);
}
/* главная перерисовывается при каждом открытии — снег подключается следом */
(function(){
  const и=window.открытьГлавную; if(typeof и!=='function') return;
  window.открытьГлавную=function(){ const r=и.apply(this,arguments); try{ снегГлавной(); }catch(_){} return r; };
  // смена темы в настройках — включить или убрать снег без перезагрузки
  new MutationObserver(()=>{ try{ снегГлавной(); }catch(_){} }).observe(document.documentElement,{attributes:true,attributeFilter:['data-ptheme','data-motion']});
  addEventListener('load',()=>{ try{ снегГлавной(); }catch(_){} });
})();
