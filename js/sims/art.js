/* ===================== РИСОВАНИЕ ВЕЩЕЙ (9.4.0, строгий вид — 9.5.0) =====================
   Общие приёмы для сцен с предметами: сосуды, жидкость, струи, цилиндр с
   поршнем, нагреватель и холодильник, приборы.

   9.5.0: тот же набор, но в языке остального пособия — плоские заливки
   цветами темы, тонкие линии, штриховка опор, ни одного градиента, блика
   или «настоящего» пламени. В 9.4 сосуды рисовались стеклом с бликами, а
   под цилиндром горела горелка: выглядело как учебная анимация двадцатилетней
   давности и спорило с чертёжной строгостью прочих сцен. Теперь предмет
   узнаётся по форме, а не по фактуре: стенка — линия, жидкость — заливка
   одного тона с линией зеркала, нагреватель — красная плита со стрелками Q.

   Все функции работают в мировых координатах сцены (y вверх). Цвета берутся
   из токенов темы (--accent, --second, --danger, --ink-2, --ink-3, --line),
   поэтому сами подстраиваются под тёмный фон и под выбранную тему.        */
globalThis.АРТ={
  /* токены темы — с коротким кэшем: getComputedStyle на каждую линию дорог */
  _т:null, _тв:0,
  т(имя){ const now=Date.now();
    if(!this._т||now-this._тв>400){ this._т={}; this._тв=now; }
    if(!(имя in this._т)){ let c=''; try{ c=typeof css==='function'?css(имя):''; }catch(_){} this._т[имя]=this.rgb(c)||[90,90,90]; }
    return this._т[имя]; },
  тёмный(){
    try{
      if(typeof prefGet==='function'&&prefGet('bgStyle')==='dark') return true;
      const rgb=this.т('--canvas'); return (0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2])/255<0.42;
    }catch(_){ return false; }
  },
  rgb(c){
    c=String(c||'').trim();
    let m=/^#([0-9a-f]{3})$/i.exec(c); if(m) return m[1].split('').map(h=>parseInt(h+h,16));
    m=/^#([0-9a-f]{6})/i.exec(c); if(m) return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));
    m=/rgba?\(([^)]+)\)/.exec(c); if(m) return m[1].split(',').slice(0,3).map(x=>+x);
    return null;
  },
  ц(rgb,a){ return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})`; },
  смесь(a,b,k){ return [0,1,2].map(i=>a[i]+(b[i]-a[i])*k); },
  px(){ return 1/(typeof ppm==='function'?ppm():40); },

  /* тон жидкости — один цвет: вода и спирт — второй цвет темы, масла —
     охра, ртуть — графит, кровь — красный темы */
  тон(имя){
    if(имя==='ртуть') return this.т('--ink-3');
    if(имя==='кровь') return this.т('--danger');
    if(имя==='масло'||имя==='глицерин'||имя==='мёд'||имя==='касторка') return имя==='мёд'?[184,120,24]:[176,138,46];
    return this.т('--second');
  },
  заливкаЖ(имя,k){ return this.ц(this.тон(имя),(this.тёмный()?0.26:0.18)*(k||1)); },
  линияЖ(имя){ return this.ц(this.тон(имя),0.9); },

  /* толща жидкости [x0,x1]×[y0, верх(x) или y1]: заливка и линия зеркала */
  жидкость(ctx,x0,y0,x1,y1,опц){
    опц=опц||{}; const верх=опц.верх, N=верх?48:1, px=this.px();
    ctx.save(); ctx.fillStyle=this.заливкаЖ(опц.тон,опц.плотн); ctx.beginPath(); ctx.moveTo(x0,y0);
    for(let i=0;i<=N;i++){ const x=x0+(x1-x0)*i/N; ctx.lineTo(x,верх?верх(x):y1); }
    ctx.lineTo(x1,y0); ctx.closePath(); ctx.fill();
    if(опц.блик!==false){ ctx.strokeStyle=this.линияЖ(опц.тон); ctx.lineWidth=1.2*px; ctx.beginPath();
      for(let i=0;i<=N;i++){ const x=x0+(x1-x0)*i/N, y=верх?верх(x):y1; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); }
    ctx.restore();
  },
  /* сосуд: стенки и дно одной линией цвета чернил */
  стакан(ctx,x0,x1,yb,yt,tw,опц){
    опц=опц||{}; const px=this.px();
    ctx.save(); ctx.strokeStyle=this.ц(this.т('--ink-2'),1); ctx.lineWidth=(опц.lw||1.8)*px; ctx.lineJoin='miter';
    ctx.beginPath();
    if(опц.дно===false){ ctx.moveTo(x0,yt); ctx.lineTo(x0,yb); ctx.moveTo(x1,yb); ctx.lineTo(x1,yt); }
    else { ctx.moveTo(x0,yt); ctx.lineTo(x0,yb); ctx.lineTo(x1,yb); ctx.lineTo(x1,yt); }
    ctx.stroke(); ctx.restore();
  },
  /* пол: линия и штриховка под ней, как на чертеже */
  пол(ctx,x0,x1,y,шаг,цвет){
    const px=this.px();
    ctx.save(); ctx.strokeStyle=цвет||this.ц(this.т('--ink-3'),1); ctx.lineWidth=1.4*px;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    ctx.globalAlpha=0.6; ctx.lineWidth=1*px; ctx.beginPath();
    for(let x=x0+шаг;x<=x1;x+=шаг){ ctx.moveTo(x,y); ctx.lineTo(x-шаг*0.7,y-шаг*0.7); }
    ctx.stroke(); ctx.restore();
  },
  /* лента вдоль ломаной pts с полушириной hw[i] */
  лента(ctx,pts,hw,заливка){
    const n=pts.length; if(n<2) return;
    const L=[],R=[];
    for(let i=0;i<n;i++){
      const a=pts[Math.max(0,i-1)], b=pts[Math.min(n-1,i+1)];
      let nx=-(b[1]-a[1]), ny=b[0]-a[0]; const d=Math.hypot(nx,ny)||1; nx/=d; ny/=d;
      L.push([pts[i][0]+nx*hw[i],pts[i][1]+ny*hw[i]]); R.push([pts[i][0]-nx*hw[i],pts[i][1]-ny*hw[i]]);
    }
    ctx.fillStyle=заливка; ctx.beginPath(); ctx.moveTo(L[0][0],L[0][1]);
    for(const q of L) ctx.lineTo(q[0],q[1]);
    for(let i=n-1;i>=0;i--) ctx.lineTo(R[i][0],R[i][1]);
    ctx.closePath(); ctx.fill();
  },
  /* струя: плоская лента цвета жидкости */
  струя(ctx,pts,hw,тон){ ctx.save(); this.лента(ctx,pts,hw,this.ц(this.тон(тон),0.75)); ctx.restore(); },
  капля(ctx,x,y,r,тон,a){
    ctx.save(); ctx.fillStyle=this.ц(this.тон(тон),0.8*(a==null?1:a)); ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.restore();
  },
  /* шар: плоский круг с тонким контуром */
  шар(ctx,x,y,r,rgb,обвод){
    rgb=rgb||this.т('--accent');
    ctx.save(); ctx.fillStyle=this.ц(rgb,1); ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    ctx.strokeStyle=обвод||this.ц(this.смесь(rgb,[0,0,0],0.35),1); ctx.lineWidth=this.px(); ctx.stroke();
    ctx.restore();
  },
  /* твёрдая деталь (поршень, стенка, станина): плоский графит */
  металл(ctx,x,y,w,h,опц){
    опц=опц||{}; const c=опц.rgb||this.т('--ink-2');
    ctx.save(); ctx.fillStyle=this.ц(c,опц.rgb?0.9:0.82); ctx.fillRect(x,y,w,h); ctx.restore();
  },
  /* цвет газа по температуре: холодный — синий темы, около 300 К — нейтральный,
     горячий — красный темы. Насыщенность умеренная: это оттенок, не картинка */
  цветT(T){
    const хол=this.т('--accent'), гор=this.т('--danger'), нейтр=this.т('--ink-3');
    if(T<=300) return this.смесь(хол,нейтр,clamp((T-120)/180,0,1));
    return this.смесь(нейтр,гор,clamp((T-300)/700,0,1));
  },
  газ(ctx,x,y,w,h,T,плотн){
    const a=(this.тёмный()?0.2:0.13)*(плотн==null?1:clamp(плотн,0.3,2.2));
    ctx.save(); ctx.fillStyle=this.ц(this.цветT(T),a); ctx.fillRect(x,y,w,h); ctx.restore();
  },
  /* прямая стрелка (теплота, поток): тонкая линия и треугольник */
  стрелка(ctx,x0,y0,x1,y1,цвет,ширина){
    const L=Math.hypot(x1-x0,y1-y0); if(L<1e-9) return;
    const px=this.px(), ux=(x1-x0)/L, uy=(y1-y0)/L, hl=Math.min(L*0.4,8*px), hw=hl*0.45;
    ctx.save(); ctx.strokeStyle=цвет; ctx.fillStyle=цвет; ctx.lineWidth=ширина||1.4*px;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1-ux*hl,y1-uy*hl); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x1-ux*hl-uy*hw,y1-uy*hl+ux*hw); ctx.lineTo(x1-ux*hl+uy*hw,y1-uy*hl-ux*hw); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  тепло(ctx,x0,y0,x1,y1,цвет,t,ширина){ this.стрелка(ctx,x0,y0,x1,y1,цвет,ширина); },
  /* нагреватель и холодильник: плоские плиты цвета теплоты */
  горелка(ctx,x,y,w,t,сила){
    if(!(сила>0.02)) return; const h=Math.max(4*this.px(),w*0.08);
    ctx.save(); ctx.fillStyle=this.ц(this.т('--danger'),0.85); ctx.fillRect(x-w/2,y-h,w,h); ctx.restore();
  },
  холод(ctx,x,y,w,h,акт){
    ctx.save(); ctx.fillStyle=this.ц(this.т('--accent'),акт?0.75:0.3); ctx.fillRect(x,y+h*0.5,w,Math.max(4*this.px(),h*0.5)); ctx.restore();
  },
  /* Вертикальный цилиндр с поршнем сверху: газ снизу, шток вверх.
     о = {x, низ, ш, H, верхГаза, T, мол:[{x,y}] в долях, тепло:'нагрев'|'холод'|'изол'|null, плотн} */
  цилиндр(ctx,о,v){
    const px=this.px(), x0=о.x-о.ш/2, x1=о.x+о.ш/2, y0=о.низ, yg=о.верхГаза, ink=this.ц(this.т('--ink-2'),1);
    const плита=Math.max(5*px,о.ш*0.07);
    if(о.тепло==='нагрев'){ ctx.fillStyle=this.ц(this.т('--danger'),0.85); ctx.fillRect(x0-плита,y0-2.2*плита,о.ш+2*плита,плита*1.2); }
    else if(о.тепло==='холод'){ ctx.fillStyle=this.ц(this.т('--accent'),0.8); ctx.fillRect(x0-плита,y0-2.2*плита,о.ш+2*плита,плита*1.2); }
    this.газ(ctx,x0,y0,о.ш,yg-y0,о.T,о.плотн);
    if(о.мол){ ctx.fillStyle=this.ц(this.т('--ink-2'),0.75);
      for(const m of о.мол){ ctx.beginPath(); ctx.arc(x0+0.04*о.ш+m.x*о.ш*0.92,y0+0.04*о.ш+m.y*Math.max(0,yg-y0-0.08*о.ш),Math.max(1.8*px,о.ш*0.012),0,7); ctx.fill(); } }
    ctx.save(); ctx.strokeStyle=ink; ctx.lineWidth=2*px; ctx.beginPath();
    ctx.moveTo(x0,y0+о.H); ctx.lineTo(x0,y0); ctx.lineTo(x1,y0); ctx.lineTo(x1,y0+о.H); ctx.stroke();
    if(о.тепло==='изол'){ ctx.lineWidth=1*px; ctx.globalAlpha=0.55; ctx.beginPath();
      const s=Math.max(6*px,о.ш*0.06);
      for(let y=y0-s;y<y0+о.H;y+=s){ ctx.moveTo(x0,y+s); ctx.lineTo(x0-s,y); ctx.moveTo(x1,y+s); ctx.lineTo(x1+s,y); }
      for(let x=x0;x<x1+s;x+=s){ ctx.moveTo(x,y0); ctx.lineTo(x-s,y0-s); }
      ctx.stroke(); ctx.globalAlpha=1; }
    ctx.restore();
    const hp=Math.max(о.ш*0.08,5*px);
    this.металл(ctx,x0,yg,о.ш,hp);
    ctx.save(); ctx.strokeStyle=ink; ctx.lineWidth=2*px; ctx.beginPath(); ctx.moveTo(о.x,yg+hp); ctx.lineTo(о.x,y0+о.H+о.ш*0.3); ctx.stroke(); ctx.restore();
    if(о.тепло==='нагрев'||о.тепло==='холод'){ const ц=this.ц(this.т(о.тепло==='нагрев'?'--danger':'--accent'),0.9), h=Math.min(о.ш*0.32,(yg-y0)*0.5);
      for(const f of [0.3,0.7]){ const xx=x0+о.ш*f;
        if(о.тепло==='нагрев') this.стрелка(ctx,xx,y0-плита*0.6,xx,y0+h,ц); else this.стрелка(ctx,xx,y0+h,xx,y0-плита*0.6,ц); } }
    return {hp};
  },
  /* термометр: тонкий контур, столбик цвета теплоты */
  термометр(ctx,x,y,h,доля,px){
    px=px||this.px(); const w=3*px, r=5*px;
    ctx.save(); ctx.strokeStyle=this.ц(this.т('--ink-3'),1); ctx.lineWidth=1*px;
    ctx.strokeRect(x-w,y,2*w,h); ctx.beginPath(); ctx.arc(x,y-r+1*px,r,0,7); ctx.stroke();
    ctx.fillStyle=this.ц(this.т('--danger'),0.9); ctx.beginPath(); ctx.arc(x,y-r+1*px,r-2*px,0,7); ctx.fill();
    ctx.fillRect(x-w+1.5*px,y,2*w-3*px,clamp(доля,0,1)*h);
    ctx.restore();
  },
  /* дуговая шкала: дорожка и заполненная часть, без стрелки */
  прибор(ctx,x,y,r,доля,px,акцент){
    px=px||this.px(); const a0=Math.PI*1.25, a1=-Math.PI*0.25, a=a0+(a1-a0)*clamp(доля,0,1);
    ctx.save(); ctx.lineCap='butt'; ctx.lineWidth=Math.max(2*px,r*0.08);
    ctx.strokeStyle=this.ц(this.т('--line'),1); ctx.beginPath(); ctx.arc(x,y,r,-a0,-a1,false); ctx.stroke();
    ctx.strokeStyle=акцент||this.ц(this.т('--accent'),1); ctx.beginPath(); ctx.arc(x,y,r,-a0,-a,false); ctx.stroke();
    ctx.restore();
  },
  /* размерная стрелка с засечками: от (x,y0) до (x,y1) по вертикали */
  размер(ctx,x,y0,y1,цвет,lw,зас){
    ctx.save(); ctx.strokeStyle=цвет; ctx.fillStyle=цвет; ctx.lineWidth=lw;
    ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1);
    ctx.moveTo(x-зас,y0); ctx.lineTo(x+зас,y0); ctx.moveTo(x-зас,y1); ctx.lineTo(x+зас,y1); ctx.stroke();
    const s=Math.sign(y1-y0)||1, h=зас*1.6;
    for(const [y,d] of [[y0,s],[y1,-s]]){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-зас*0.7,y+d*h); ctx.lineTo(x+зас*0.7,y+d*h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
};

/* ===================== ИНСТРУМЕНТЫ МОДЕЛИ: РУЧКИ И ЗОНД (9.5.0) =====================
   Два общих инструмента, из которых сцены собирают свои.

   РУЧКИ — перетаскиваемые точки прямо на рисунке: уровень воды, отверстие,
   поршень, вершина цикла на pV-диаграмме, край интервала скоростей. Сцена
   отдаёт список ручек: {id, x, y, имя, тянуть(т, wx, wy), клав:{ArrowUp:[ключ, шаг], …}}.
   Нажатие хватает ближайшую ручку в пределах 18 пикселей; стрелки
   клавиатуры двигают выбранную (с Shift — в десять раз крупнее).

   ЗОНД — щелчок в любую точку сцены показывает местные величины: давление
   на этой глубине, скорость в этом сечении, температуру в этой точке
   стержня. Сцена отдаёт функцию (p, s, wx, wy) → [строки] или null, если
   точка вне тела. Последний замер остаётся на рисунке, пока инструмент
   выбран: можно сравнить две точки, переставляя зонд.                     */
globalThis.РУЧКИ=function(опц){
  const список=т=>{ try{ return (опц.ручки(т.p,т.s)||[]).filter(h=>h&&isFinite(h.x)&&isFinite(h.y)); }catch(_){ return []; } };
  const экран=(т,h)=>т.toScreen(h.x,h.y);
  return {id:опц.id||'grips', name:опц.name||'Ручки', cursor:'grab', список,
    icon:опц.icon||'<rect x="3.5" y="3.5" width="6" height="6"/><rect x="14.5" y="14.5" width="6" height="6"/><path d="M9.5 9.5l5 5"/>',
    hint:опц.hint||'тяните квадратные ручки на рисунке; стрелки клавиатуры двигают выбранную, с Shift — крупнее',
    down(т){ let лучш=null, d0=18;
      for(const h of список(т)){ const [sx,sy]=экран(т,h), d=Math.hypot(sx-т.px,sy-т.py); if(d<d0){ d0=d; лучш=h; } }
      if(!лучш) return false; т.выбор.ручка=лучш.id; т.выбор.старт={wx:т.wx,wy:т.wy,p:Object.assign({},т.p),s:т.s}; return true; },
    /* старт — снимок в момент нажатия: ручки, у которых шкала рисунка сама
       зависит от тянущегося параметра, считают от него, а не от текущего
       кадра — иначе ручка «убегает» из-под курсора */
    move(т){ const h=список(т).find(x=>x.id===т.выбор.ручка); if(h&&h.тянуть) h.тянуть(т,т.wx,т.wy,т.выбор.старт||{wx:т.wx,wy:т.wy,p:т.p}); },
    key(k,т){ const h=список(т).find(x=>x.id===т.выбор.ручка)||список(т)[0]; if(!h||!h.клав||!h.клав[k]) return false;
      т.выбор.ручка=h.id; const [ключ,шаг]=h.клав[k]; т.set(ключ,(+т.p[ключ])+шаг*(т.shift?10:1)); return true; },
    overlay(o,т){ const px=1/т.ppm, ac=css('--accent');
      for(const h of список(т)){ const выбр=h.id===т.выбор.ручка, r=(выбр?5:4)*px;
        o.save(); o.fillStyle=выбр?ac:(css('--canvas')||'#fff'); o.strokeStyle=ac; o.lineWidth=1.4*px;
        o.fillRect(h.x-r,h.y-r,2*r,2*r); o.strokeRect(h.x-r,h.y-r,2*r,2*r); o.restore();
        if(выбр||список(т).length<=2) VIEW.label(o,typeof h.имя==='function'?h.имя(т.p,т.s):h.имя,h.x,h.y,10,-12,ac); } }};
};
globalThis.ЗОНД=function(опц){
  return {id:опц.id||'probe', name:опц.name||'Зонд', cursor:'crosshair',
    icon:опц.icon||'<circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
    hint:опц.hint||'щёлкните в любую точку — местные величины; тяните, чтобы водить зондом',
    down(т){ т.выбор.зонд=[т.wx,т.wy]; return true; },
    move(т){ т.выбор.зонд=[т.wx,т.wy]; },
    overlay(o,т){ const з=т.выбор.зонд; if(!з) return; let стр=null; try{ стр=опц.замер(т.p,т.s,з[0],з[1]); }catch(_){ стр=null; }
      const px=1/т.ppm, c=css('--measure');
      o.save(); o.strokeStyle=c; o.lineWidth=1.2*px; o.beginPath();
      o.moveTo(з[0]-8*px,з[1]); o.lineTo(з[0]+8*px,з[1]); o.moveTo(з[0],з[1]-8*px); o.lineTo(з[0],з[1]+8*px); o.stroke();
      o.beginPath(); o.arc(з[0],з[1],3*px,0,7); o.stroke(); o.restore();
      (стр||['вне тела — здесь мерить нечего']).forEach((s,i)=>VIEW.label(o,s,з[0],з[1],12,-12+i*14,c)); }};
};
/* РУЧКИ_П — короткая запись ручек, привязанных к параметрам. Каждая:
   {key, где:(p,s)→[x,y], ось:'x'|'y', k — изменение параметра на единицу
   сцены (линейно) или лог — на сколько единиц сцены параметр удваивается,
   знак, имя}. Если где() даёт точку, совпадающую с тем, что параметр и
   задаёт (уровень, конец нити), — укажите точно:true и set:(т,wx,wy) сами.
   Значение считается от снимка в момент нажатия, поэтому шкала рисунка,
   которая сама зависит от параметра, не уводит ручку из-под курсора.     */
globalThis.РУЧКИ_П=function(опц){
  return РУЧКИ({name:опц.name, hint:опц.hint, ручки(p,s){ return опц.ручки.filter(h=>!h.если||h.если(p)).map(h=>{ const [x,y]=h.где(p,s);
    const шаг=(h.шаг!=null?h.шаг:1);
    return {id:h.key+(h.id||''),x,y,имя:h.имя||(p=>`${h.подп||h.key} = ${p[h.key]}`),
      тянуть(т,wx,wy,ст){ if(h.set) return h.set(т,wx,wy,ст);
        const d=((h.ось==='y')?(wy-ст.wy):(wx-ст.wx))*(h.знак||1), v0=+ст.p[h.key];
        т.set(h.key,h.лог?v0*Math.pow(2,d/h.лог):v0+d*h.k); },
      клав:h.ось==='y'?{ArrowUp:[h.key,шаг*(h.знак||1)],ArrowDown:[h.key,-шаг*(h.знак||1)]}:{ArrowRight:[h.key,шаг*(h.знак||1)],ArrowLeft:[h.key,-шаг*(h.знак||1)]}}; }); }});
};
