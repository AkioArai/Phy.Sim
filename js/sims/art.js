/* ===================== РИСОВАНИЕ ВЕЩЕЙ (9.4.0) =====================
   Общие приёмы для сцен, где на экране — настоящие предметы: сосуды,
   жидкость, струи, цилиндры с поршнем, горелка. До 9.4 такие сцены
   рисовались схемой: прямоугольник с заливкой 20 % и линия струи. Это
   математически честно, но читается плохо: человек, который ни разу не
   видел опыта, принимает штриховой контур за «нечто» и не узнаёт в нём
   банку с водой. Здесь собран небольшой набор: стекло с бликом и толщиной
   стенок, жидкость с глубиной цвета и мениском, струя-лента, сужающаяся по
   уравнению неразрывности, капли, пол со штриховкой, металл, газ, окрашенный
   по температуре, пламя и холодильник.

   Все функции работают в мировых координатах сцены (y вверх, метры сцены):
   градиенты создаются там же, где рисуется фигура, поэтому масштаб и сдвиг
   вида на них не влияют. Цвета подстраиваются под тёмный фон.            */
globalThis.АРТ={
  /* тёмный ли фон сцены: настройка фона или яркость --canvas */
  тёмный(){
    try{
      if(typeof prefGet==='function'&&prefGet('bgStyle')==='dark') return true;
      const c=(typeof css==='function'?css('--canvas'):'')||'#fff';
      const rgb=this.rgb(c); return rgb?(0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2])/255<0.42:false;
    }catch(_){ return false; }
  },
  rgb(c){
    c=String(c).trim();
    let m=/^#([0-9a-f]{3})$/i.exec(c); if(m) return m[1].split('').map(h=>parseInt(h+h,16));
    m=/^#([0-9a-f]{6})/i.exec(c); if(m) return [0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));
    m=/rgba?\(([^)]+)\)/.exec(c); if(m) return m[1].split(',').slice(0,3).map(x=>+x);
    return null;
  },
  ц(rgb,a){ return `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${a})`; },
  смесь(a,b,k){ return [0,1,2].map(i=>a[i]+(b[i]-a[i])*k); },

  /* оттенки жидкостей: [поверхность, глубина]; ртуть — металл */
  ЖИДК:{
    вода:[[120,186,232],[34,104,178]], глицерин:[[236,214,150],[196,150,60]], мёд:[[240,190,90],[176,104,22]],
    масло:[[240,222,130],[196,160,40]], касторка:[[232,208,140],[184,146,62]], спирт:[[176,214,240],[90,150,210]],
    ртуть:[[214,218,226],[118,124,138]], кровь:[[214,96,96],[140,30,40]]
  },
  тон(имя){ return this.ЖИДК[имя]||this.ЖИДК.вода; },

  /* толща жидкости: прямоугольник [x0,x1]×[y0,y1] с глубиной цвета.
     верх(x) — необязательная форма поверхности (волна, мениск). */
  жидкость(ctx,x0,y0,x1,y1,опц){
    опц=опц||{}; const [вер,низ]=this.тон(опц.тон), тёмн=this.тёмный(), a=опц.прозр!=null?опц.прозр:(тёмн?0.62:0.55);
    const g=ctx.createLinearGradient(0,y1,0,y0);
    g.addColorStop(0,this.ц(вер,a*0.85)); g.addColorStop(1,this.ц(низ,a));
    ctx.save(); ctx.fillStyle=g; ctx.beginPath();
    const верх=опц.верх, N=верх?40:1;
    ctx.moveTo(x0,y0);
    for(let i=0;i<=N;i++){ const x=x0+(x1-x0)*i/N; ctx.lineTo(x,верх?верх(x):y1); }
    ctx.lineTo(x1,y0); ctx.closePath(); ctx.fill();
    // световая полоса у поверхности и тонкая линия зеркала
    if(опц.блик!==false){
      ctx.strokeStyle=this.ц(тёмн?[220,236,255]:[255,255,255],тёмн?0.35:0.75); ctx.lineWidth=опц.lw||0.01;
      ctx.beginPath(); for(let i=0;i<=N;i++){ const x=x0+(x1-x0)*i/N, y=верх?верх(x):y1; i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
    }
    ctx.restore();
  },
  /* стеклянный сосуд: стенки толщиной tw, дно, губа сверху и блик */
  стакан(ctx,x0,x1,yb,yt,tw,опц){
    опц=опц||{}; const тёмн=this.тёмный();
    const стекло=this.ц(тёмн?[170,200,225]:[150,180,200],тёмн?0.30:0.32), край=this.ц(тёмн?[190,215,235]:[90,115,135],тёмн?0.75:0.8);
    ctx.save(); ctx.fillStyle=стекло;
    ctx.fillRect(x0-tw,yb-tw,tw,yt-yb+tw); ctx.fillRect(x1,yb-tw,tw,yt-yb+tw);
    if(опц.дно!==false) ctx.fillRect(x0,yb-tw,x1-x0,tw);
    ctx.strokeStyle=край; ctx.lineWidth=опц.lw||tw*0.18;
    ctx.beginPath();
    ctx.moveTo(x0-tw,yt); ctx.lineTo(x0-tw,yb-tw); ctx.lineTo(x1+tw,yb-tw); ctx.lineTo(x1+tw,yt);
    ctx.moveTo(x0,yt); ctx.lineTo(x0,yb); ctx.lineTo(x1,yb); ctx.lineTo(x1,yt);
    ctx.stroke();
    // губы сверху
    ctx.beginPath(); ctx.moveTo(x0-tw,yt); ctx.lineTo(x0,yt); ctx.moveTo(x1,yt); ctx.lineTo(x1+tw,yt); ctx.stroke();
    // блики: длинный у левой стенки и короткий у правой
    const w=x1-x0;
    ctx.fillStyle=this.ц([255,255,255],тёмн?0.08:0.26);
    ctx.fillRect(x0+w*0.06,yb+(yt-yb)*0.08,Math.max(tw*0.8,w*0.025),(yt-yb)*0.8);
    ctx.fillStyle=this.ц([255,255,255],тёмн?0.06:0.22);
    ctx.fillRect(x1-w*0.12,yb+(yt-yb)*0.35,Math.max(tw*0.5,w*0.018),(yt-yb)*0.4);
    ctx.restore();
  },
  /* пол: линия и штриховка под ней, как на чертеже */
  пол(ctx,x0,x1,y,шаг,цвет){
    ctx.save(); ctx.strokeStyle=цвет; ctx.lineWidth=шаг*0.09;
    ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke();
    ctx.globalAlpha=0.55; ctx.lineWidth=шаг*0.05; ctx.beginPath();
    for(let x=x0;x<x1;x+=шаг){ ctx.moveTo(x,y); ctx.lineTo(x-шаг*0.8,y-шаг*0.8); }
    ctx.stroke(); ctx.restore();
  },
  /* лента вдоль ломаной pts с полушириной hw[i]: струя, трубка, нить */
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
  /* струя жидкости: лента + светлая жилка по середине */
  струя(ctx,pts,hw,тон){
    const [вер,низ]=this.тон(тон), тёмн=this.тёмный();
    ctx.save();
    this.лента(ctx,pts,hw,this.ц(this.смесь(вер,низ,0.45),тёмн?0.8:0.78));
    this.лента(ctx,pts,hw.map(h=>h*0.35),this.ц([255,255,255],тёмн?0.25:0.45));
    ctx.restore();
  },
  капля(ctx,x,y,r,тон,a){
    const [вер,низ]=this.тон(тон);
    ctx.save(); ctx.globalAlpha*=(a==null?1:a);
    const g=ctx.createRadialGradient(x-r*0.35,y+r*0.35,r*0.1,x,y,r);
    g.addColorStop(0,this.ц([255,255,255],0.9)); g.addColorStop(0.35,this.ц(вер,0.9)); g.addColorStop(1,this.ц(низ,0.9));
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); ctx.restore();
  },
  /* шар: металл, пластик, дерево — цвет задаётся */
  шар(ctx,x,y,r,rgb,обвод){
    const g=ctx.createRadialGradient(x-r*0.38,y+r*0.42,r*0.05,x,y,r);
    g.addColorStop(0,this.ц(this.смесь(rgb,[255,255,255],0.85),1)); g.addColorStop(0.45,this.ц(rgb,1));
    g.addColorStop(1,this.ц(this.смесь(rgb,[0,0,0],0.55),1));
    ctx.save(); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    if(обвод){ ctx.strokeStyle=обвод; ctx.lineWidth=r*0.06; ctx.stroke(); }
    ctx.restore();
  },
  /* металлическая деталь: горизонтальный (верт=false) или вертикальный блеск */
  металл(ctx,x,y,w,h,опц){
    опц=опц||{}; const base=опц.rgb||(this.тёмный()?[150,158,172]:[160,168,180]);
    const g=опц.верт?ctx.createLinearGradient(x,0,x+w,0):ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,this.ц(this.смесь(base,[0,0,0],0.35),1)); g.addColorStop(0.35,this.ц(this.смесь(base,[255,255,255],0.55),1));
    g.addColorStop(0.6,this.ц(base,1)); g.addColorStop(1,this.ц(this.смесь(base,[0,0,0],0.45),1));
    ctx.save(); ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=this.ц(this.смесь(base,[0,0,0],0.6),0.9); ctx.lineWidth=Math.min(Math.abs(w),Math.abs(h))*0.04; ctx.strokeRect(x,y,w,h);
    ctx.restore();
  },
  /* цвет газа по температуре: холодный — голубой, комнатный — серо-голубой,
     горячий — оранжевый и красный */
  цветT(T){
    const шк=[[150,[90,150,235]],[300,[150,175,205]],[500,[235,170,90]],[800,[230,110,60]],[1300,[215,50,40]]];
    if(T<=шк[0][0]) return шк[0][1];
    for(let i=1;i<шк.length;i++) if(T<=шк[i][0]){ const k=(T-шк[i-1][0])/(шк[i][0]-шк[i-1][0]); return this.смесь(шк[i-1][1],шк[i][1],k); }
    return шк[шк.length-1][1];
  },
  газ(ctx,x,y,w,h,T,плотн){
    const c=this.цветT(T), a=(this.тёмный()?0.22:0.2)*(плотн==null?1:clamp(плотн,0.3,2.2));
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,this.ц(c,a*1.15)); g.addColorStop(1,this.ц(c,a*0.8));
    ctx.save(); ctx.fillStyle=g; ctx.fillRect(x,y,w,h); ctx.restore();
  },
  /* пламя горелки шириной w с основанием в (x,y); сила 0…1 — высота языков */
  пламя(ctx,x,y,w,t,сила){
    if(!(сила>0.02)) return;
    ctx.save();
    const n=Math.max(3,Math.round(w/(w*0.18))), h0=w*0.55*clamp(сила,0,1.4);
    for(let k=0;k<n;k++){
      const cx=x-w/2+w*(k+0.5)/n, ф=t*7+k*1.7, h=h0*(0.75+0.25*Math.sin(ф)+0.12*Math.sin(ф*2.3)), hw=w/n*0.55;
      const g=ctx.createLinearGradient(0,y,0,y+h);
      g.addColorStop(0,'rgba(70,120,255,0.85)'); g.addColorStop(0.25,'rgba(255,190,60,0.85)'); g.addColorStop(1,'rgba(255,90,30,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(cx-hw,y);
      ctx.quadraticCurveTo(cx-hw*1.1,y+h*0.45,cx+Math.sin(ф*1.3)*hw*0.3,y+h);
      ctx.quadraticCurveTo(cx+hw*1.1,y+h*0.45,cx+hw,y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  },
  /* горелка: корпус и пламя над ним */
  горелка(ctx,x,y,w,t,сила){
    this.металл(ctx,x-w*0.35,y-w*0.22,w*0.7,w*0.22);
    this.пламя(ctx,x,y,w*0.8,t,сила);
  },
  /* холодильник: плита со льдом и инеем */
  холод(ctx,x,y,w,h,акт){
    const тёмн=this.тёмный();
    const g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,this.ц([150,200,240],акт?0.85:0.4)); g.addColorStop(1,this.ц([210,235,250],акт?0.9:0.45));
    ctx.save(); ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=this.ц(тёмн?[220,240,255]:[255,255,255],акт?0.9:0.5); ctx.lineWidth=h*0.05;
    ctx.beginPath();
    for(let i=1;i<7;i++){ const cx=x+w*i/7, cy=y+h*0.5, r=h*0.22;
      for(let k=0;k<3;k++){ const a=k*Math.PI/3; ctx.moveTo(cx-Math.cos(a)*r,cy-Math.sin(a)*r); ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); } }
    ctx.stroke(); ctx.restore();
  },
  /* волнистая стрелка теплоты от (x0,y0) к (x1,y1) */
  тепло(ctx,x0,y0,x1,y1,цвет,t,ширина){
    const L=Math.hypot(x1-x0,y1-y0); if(L<1e-9) return;
    const ux=(x1-x0)/L, uy=(y1-y0)/L, nx=-uy, ny=ux, A=L*0.06, волн=3, ф=(t||0)*6;
    ctx.save(); ctx.strokeStyle=цвет; ctx.fillStyle=цвет; ctx.lineWidth=ширина||L*0.04; ctx.lineCap='round';
    ctx.beginPath();
    const Lh=L*0.82;
    for(let i=0;i<=40;i++){ const s=Lh*i/40, w=A*Math.sin(s/Lh*волн*2*Math.PI-ф);
      const x=x0+ux*s+nx*w, y=y0+uy*s+ny*w; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
    const hx=x0+ux*Lh, hy=y0+uy*Lh, hl=L*0.18, hw=L*0.1;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(hx+nx*hw,hy+ny*hw); ctx.lineTo(hx-nx*hw,hy-ny*hw); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  /* Вертикальный цилиндр с поршнем сверху: газ снизу, шток вверх.
     о = {x, низ, ш, H (высота внутри), верхГаза, T, мол:[{x,y}] в долях,
          тепло:'нагрев'|'холод'|'изол'|null, сила 0…1, t, плотн} */
  цилиндр(ctx,о,v){
    const px=1/ppm(), tw=Math.max(4*px,о.ш*0.05), x0=о.x-о.ш/2, x1=о.x+о.ш/2, y0=о.низ, yg=о.верхГаза, тёмн=this.тёмный();
    // основание: горелка, холодильник или подставка
    const yb=y0-tw;
    if(о.тепло==='нагрев') this.горелка(ctx,о.x,yb-о.ш*0.32,о.ш*0.9,о.t||0,о.сила==null?1:о.сила);
    else if(о.тепло==='холод') this.холод(ctx,x0-tw,yb-о.ш*0.2,о.ш+2*tw,о.ш*0.18,true);
    // газ
    this.газ(ctx,x0,y0,о.ш,yg-y0,о.T,о.плотн);
    if(о.мол){ const c=this.цветT(о.T); ctx.fillStyle=this.ц(this.смесь(c,[0,0,0],0.25),0.9);
      for(const m of о.мол){ ctx.beginPath(); ctx.arc(x0+tw*0.6+m.x*(о.ш-1.2*tw),y0+tw*0.6+m.y*Math.max(0,yg-y0-1.2*tw),Math.max(2.2*px,о.ш*0.018),0,7); ctx.fill(); } }
    // стенки и дно
    this.металл(ctx,x0-tw,yb,tw,о.H+tw,{верт:true}); this.металл(ctx,x1,yb,tw,о.H+tw,{верт:true});
    this.металл(ctx,x0,yb,о.ш,tw);
    if(о.тепло==='изол'){ ctx.save(); ctx.strokeStyle=this.ц(тёмн?[220,200,150]:[150,120,60],0.75); ctx.lineWidth=1*px;
      for(const [a,b] of [[x0-tw-3*tw,x0-tw],[x1+tw,x1+4*tw]]){ ctx.strokeRect(a,yb-tw,b-a,о.H+2*tw);
        ctx.beginPath(); for(let y=yb;y<yb+о.H;y+=3*tw){ ctx.moveTo(a,y); ctx.lineTo(b,y+3*tw); } ctx.stroke(); }
      ctx.strokeRect(x0-4*tw,yb-4*tw,о.ш+8*tw,3*tw); ctx.restore(); }
    // поршень с кольцами и шток
    const hp=Math.max(о.ш*0.12,6*px);
    this.металл(ctx,x0,yg,о.ш,hp);
    ctx.strokeStyle=this.ц([40,44,52],0.5); ctx.lineWidth=1*px; ctx.beginPath();
    ctx.moveTo(x0,yg+hp*0.3); ctx.lineTo(x1,yg+hp*0.3); ctx.moveTo(x0,yg+hp*0.55); ctx.lineTo(x1,yg+hp*0.55); ctx.stroke();
    const ш2=о.ш*0.07; this.металл(ctx,о.x-ш2/2,yg+hp,ш2,Math.max(0,y0+о.H+о.ш*0.35-yg-hp),{верт:true});
    // теплота: волнистые стрелки
    if(о.тепло==='нагрев'||о.тепло==='холод'){ const ц=о.тепло==='нагрев'?'rgba(225,90,40,0.85)':'rgba(60,130,220,0.85)';
      for(const f of [0.3,0.7]){ const xx=x0+о.ш*f;
        if(о.тепло==='нагрев') this.тепло(ctx,xx,yb-о.ш*0.05,xx,y0+Math.min(о.ш*0.4,(yg-y0)*0.6),ц,о.t,1.6*px);
        else this.тепло(ctx,xx,y0+Math.min(о.ш*0.4,(yg-y0)*0.6),xx,yb-о.ш*0.02,ц,о.t,1.6*px); } }
    return {tw,hp};
  },
  /* термометр: колба внизу в (x,y), шкала высотой h; доля 0…1 — высота столбика */
  термометр(ctx,x,y,h,доля,px){
    const тёмн=this.тёмный(), r=Math.max(5*px,h*0.07), w=r*0.55;
    ctx.save();
    ctx.fillStyle=this.ц(тёмн?[60,64,76]:[250,251,252],0.95); ctx.strokeStyle=this.ц(тёмн?[190,200,215]:[110,120,135],0.9); ctx.lineWidth=1.1*px;
    ctx.beginPath(); ctx.moveTo(x-w,y); ctx.lineTo(x-w,y+h); ctx.arc(x,y+h,w,Math.PI,0,true); ctx.lineTo(x+w,y); ctx.arc(x,y-r*0.8,r,-Math.PI/2+0.6,-Math.PI/2-0.6+2*Math.PI,false); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='rgba(214,52,46,0.95)'; ctx.beginPath(); ctx.arc(x,y-r*0.8,r*0.72,0,7); ctx.fill();
    ctx.fillRect(x-w*0.45,y-r*0.2,w*0.9,clamp(доля,0,1)*h+r*0.2);
    ctx.strokeStyle=this.ц(тёмн?[200,210,225]:[90,100,115],0.7); ctx.lineWidth=0.8*px; ctx.beginPath();
    for(let k=0;k<=10;k++){ const yy=y+h*k/10, l=k%5?w*0.7:w*1.3; ctx.moveTo(x+w,yy); ctx.lineTo(x+w+l,yy); } ctx.stroke();
    ctx.restore();
  },
  /* стрелочный прибор: центр (x,y), радиус r, доля 0…1 по шкале в 270° */
  прибор(ctx,x,y,r,доля,px,акцент){
    const тёмн=this.тёмный(), a0=Math.PI*1.25, a1=-Math.PI*0.25;
    ctx.save();
    const g=ctx.createRadialGradient(x-r*0.3,y+r*0.3,r*0.1,x,y,r);
    g.addColorStop(0,this.ц(тёмн?[70,74,86]:[255,255,255],1)); g.addColorStop(1,this.ц(тёмн?[44,47,58]:[226,230,236],1));
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
    ctx.strokeStyle=this.ц(тёмн?[170,178,190]:[120,128,140],1); ctx.lineWidth=Math.max(1.2*px,r*0.07); ctx.stroke();
    ctx.lineWidth=0.9*px; ctx.beginPath();
    for(let k=0;k<=10;k++){ const a=a0+(a1-a0)*k/10, l=k%5?0.12:0.22;
      ctx.moveTo(x+Math.cos(a)*r*0.86,y+Math.sin(a)*r*0.86); ctx.lineTo(x+Math.cos(a)*r*(0.86-l),y+Math.sin(a)*r*(0.86-l)); } ctx.stroke();
    const a=a0+(a1-a0)*clamp(доля,0,1.05);
    ctx.strokeStyle=акцент||'rgba(200,50,40,0.95)'; ctx.lineWidth=Math.max(1.4*px,r*0.06); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x-Math.cos(a)*r*0.12,y-Math.sin(a)*r*0.12); ctx.lineTo(x+Math.cos(a)*r*0.78,y+Math.sin(a)*r*0.78); ctx.stroke();
    ctx.fillStyle=this.ц([60,64,76],1); ctx.beginPath(); ctx.arc(x,y,r*0.08,0,7); ctx.fill();
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
