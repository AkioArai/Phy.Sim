'use strict';
/* =============================================================================
   PHY.SIM — ЯДРО. Контракт:

   SIMS[id] = {
     title,
     params:[ {key,label,unit,min,max,step,default}
            | {key,label,type:'check',default}
            | {key,label,type:'select',options:[{v,t}],default}
            | {key,type:'group',label}  // визуальный разделитель
     ],
     init(p)->state,                       // state.t — время, обязательно
     step(s,dt,p),                         // может выставить s.__stop = 'текст' → таймер встаёт
     draw(ctx,s,view,p),                   // мировые координаты, y вверх
     anchors(s,p)->[{x,y}],
     readouts(s,p)->[[label,value,unit]],  // HUD
     graphs:[{label,unit,series?:[n1,n2],get(s,p)->[y1,y2|null]}],
     presets?:[{name,values:{...}}],       // готовые наборы (примеры из учебника)
     fit(p,{W,H})->{x,y,scale}
   }
   TOPIC = { id, ch, title, theory, formulas:[{tex,note,sim?}], problems:[] }
   ============================================================================= */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const DT=1/240, PX_PER_M=40;
const EMPTY_DASH=[];                 // переиспользуем: setLineDash([]) на каждом кадре плодил мусор

/* Реестр симуляций: каждый файл js/sims/* добавляет сюда свои определения. */
const SIMS={};
