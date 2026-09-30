'use strict';
/* =============================================================================
   КВАНТОВЫЕ СЦЕНЫ, ПЕРЕРИСОВАННЫЕ В 3.2.0

   Эффект Комптона, волна де Бройля, волновой пакет, частица в ящике, спектр
   водорода и рентгеновская трубка. Прежние версии были статичными схемами с
   подписями: читатель видел картинку, но не видел процесса. Теперь в каждой
   сцене что-то происходит, и происходящее связано с формулой:

     · Комптон — фотон-пакет налетает на электрон, после удара уходит
       длинноволновым; рядом баланс энергии и треугольник импульсов;
     · де Бройль — электроны по одному пролетают кристалл и копятся на
       экране в полосы; длина волны нарисована рядом с решёткой в одном масштабе;
     · пакет — свободный гауссов пакет честно расплывается по точной формуле:
       узкий пакет расплывается быстро, потому что у него широкий разброс импульсов;
     · ящик — вода в лотке: бегущая волна отражается от стенок и складывается
       со своим отражением в стоячую; лоток можно поворачивать;
     · спектр водорода — электрон падает с уровня на уровень, фотон летит
       в спектроскоп и зажигает там свою линию;
     · рентген — трубка: электроны бьют в анод, фотоны разлетаются и копятся
       в спектре; сбоку показано, что творится в атоме анода.

   Показания и имена параметров прежние — на них опираются задачи и проверки.
   ============================================================================= */
const КС={
  /* генератор с зерном в состоянии сцены: картина повторяется от запуска к запуску */
  rnd(s){ let t=(s.seed=(s.seed+0x6D2B79F5)|0); t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; },
  гаусс(s){ const u=Math.max(1e-12,this.rnd(s)), w=this.rnd(s); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*w); },
  /* фотон с центром в (x0,y0) — обёртка над VIEW.photon */
  пакет(ctx,v,x0,y0,dir,lam,amp,sig,phase,color,lw){
    /* центр (x0,y0), длина 5σ: рисует общий фотон VIEW.photon */
    const L=5*sig; v.photon(ctx,x0+Math.cos(dir)*L/2,y0+Math.sin(dir)*L/2,dir,{len:L,lam,amp,phase,color,lw});
  },
  /* рамка-панель с заголовком: скруглённый прямоугольник (arcTo — roundRect есть не везде) */
  рамка(ctx,v,x,y,w,h,title){
    const r=Math.min(0.18,w/4,h/4);
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
    ctx.fillStyle=v.c('--panel')||'#fff'; ctx.globalAlpha=.55; ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=v.c('--line')||'#ccc'; ctx.lineWidth=v.lw(1); ctx.stroke();
    if(title) v.text(ctx,title,x+0.18,y+h-0.28,v.c('--ink-3'),11,'left',true);
  },
  пунктир(ctx,v,x0,y0,x1,y1,color,alpha){
    ctx.save(); ctx.strokeStyle=color; ctx.globalAlpha=alpha==null?.45:alpha; ctx.lineWidth=v.lw(1.1);
    ctx.setLineDash([v.lw(4),v.lw(4)]); ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke(); ctx.restore();
  },
  /* дуга угла полилинией: у ctx.arc направление зеркалится из-за оси y сцены */
  дуга(ctx,v,cx,cy,a0,a1,r,color){
    ctx.strokeStyle=color; ctx.lineWidth=v.lw(1.3); ctx.beginPath();
    for(let i=0;i<=30;i++){ const a=a0+(a1-a0)*i/30, x=cx+r*Math.cos(a), y=cy+r*Math.sin(a); i?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
  },
  /* цвет по длине волны (нм): видимая часть — радугой, за её краями — условные цвета */
  цветλ(l){
    if(l<380) return '#7c5cc4'; if(l>750) return '#b3413a';
    let r=0,g=0,b=0;
    if(l<440){ r=(440-l)/60; b=1; } else if(l<490){ g=(l-440)/50; b=1; } else if(l<510){ g=1; b=(510-l)/20; }
    else if(l<580){ r=(l-510)/70; g=1; } else if(l<645){ r=1; g=(645-l)/65; } else r=1;
    const f=l<420?0.35+0.65*(l-380)/40:(l>700?0.35+0.65*(750-l)/50:1);
    const c=x=>Math.round(255*Math.pow(clamp(x*f,0,1),0.8));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  },
  /* абзац с переносом по ширине w (в единицах сцены): длинная строка сама
     ломается по словам, а не вылезает за панель в узком окне (3.4.0).
     Возвращает y под последней строкой. */
  абзац(ctx,v,text,x,y,w,color,px,align,bold){
    px=px||10; const k=v.textK||1, шаг=px*k*1.35/ppm(), ширина=w*ppm();
    ctx.save(); ctx.font=(bold?'600 ':'')+sceneFont(px*k);
    const строки=[]; let cur='';
    for(const слово of String(text).split(' ')){
      const t=cur?cur+' '+слово:слово;
      if(cur && ctx.measureText(безВекторов(t)).width>ширина){ строки.push(cur); cur=слово; } else cur=t;
    }
    if(cur) строки.push(cur); ctx.restore();
    const ax=align==='center'?x+w/2:(align==='right'?x+w:x);
    строки.forEach((l,i)=>v.text(ctx,l,ax,y-i*шаг,color,px,align||'left',bold));
    return y-строки.length*шаг;
  },
  /* растровое поле в прямоугольнике сцены (x0, y0, w, h): f(x, y) → [r, g, b, a],
     a в 0…1. Считается в маленьком холсте и растягивается со сглаживанием —
     так интерференционная картина рисуется за один drawImage, а не тысячами
     прямоугольников (3.5.0). */
  поле(ctx,x0,y0,w,h,W,H,f){
    const c=this._пол||(this._пол=document.createElement('canvas'));
    if(c.width!==W||c.height!==H){ c.width=W; c.height=H; this._img=null; }
    const g=c.getContext('2d'), img=this._img||(this._img=g.createImageData(W,H)), d=img.data;
    for(let j=0;j<H;j++){ const y=y0+(j+0.5)/H*h;
      for(let i=0;i<W;i++){ const x=x0+(i+0.5)/W*w, q=f(x,y), o=(j*W+i)*4;
        d[o]=q[0]; d[o+1]=q[1]; d[o+2]=q[2]; d[o+3]=Math.round(255*clamp(q[3],0,1)); } }
    g.putImageData(img,0,0);
    ctx.save(); ctx.imageSmoothingEnabled=true; ctx.drawImage(c,x0,y0,w,h); ctx.restore();   // строки идут снизу вверх: ось y сцены смотрит вверх
  },
  rgbλ(l){ const m=/rgb\((\d+),(\d+),(\d+)\)/.exec(this.цветλ(l)); return m?[+m[1],+m[2],+m[3]]:[120,90,200]; },
  точка(ctx,v,x,y,rpx,color){ ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,v.lw(rpx),0,7); ctx.fill(); },
  fitBox(vp,w,h,cx,cy){
    const W=(vp&&vp.W)||460,H=(vp&&vp.H)||320;
    return {x:cx||0,y:cy||0,scale:clamp(Math.min((W-16)/(w*PX_PER_M),(H-16)/(h*PX_PER_M)),0.002,30)};
  }
};

Object.assign(SIMS,{

/* ================= ГЛ.24: ЭФФЕКТ КОМПТОНА ================= */
compton:{
  title:'Эффект Комптона: фотон как частица',
  /* Длины волн пикометровые — сцена-схема без осей с числами. Показания от
     времени не зависят; движение — повторяющийся рассказ об одном ударе. */
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'lam',label:'Длина волны падающего фотона λ',unit:'пм',min:1,max:100,step:0.5,default:20},
    {key:'ang',label:'Угол рассеяния θ',unit:'°',min:0,max:180,step:1,default:90},

    {type:'group',label:'Показывать'},
    {key:'bars', label:'Баланс энергии: до и после удара',type:'check',default:true},
    {key:'vec',  label:'Треугольник импульсов p⃗ = p⃗′ + p⃗ₑ',type:'check',default:true},
    {key:'graph',label:'График Δλ(θ)',type:'check',default:true}
  ],
  h:6.62607015e-34, me:9.1093837015e-31, c:2.99792458e8, e:1.602176634e-19,
  /* комптоновская длина волны электрона: λC = h/(mc) = 2.426 пм */
  lamC(){ return this.h/(this.me*this.c)*1e12; },
  /* сдвиг длины волны: Δλ = λC·(1 − cosθ) */
  dLam(p){ return this.lamC()*(1-Math.cos(p.ang*Math.PI/180)); },
  lamOut(p){ return p.lam+this.dLam(p); },
  /* энергии фотона до и после (кэВ) */
  Ein(p){ return this.h*this.c/(p.lam*1e-12)/this.e/1e3; },
  Eout(p){ return this.h*this.c/(this.lamOut(p)*1e-12)/this.e/1e3; },
  Eelectron(p){ return this.Ein(p)-this.Eout(p); },       // энергия отдачи электрона
  /* импульс фотона p = h/λ */
  pIn(p){ return this.h/(p.lam*1e-12); },
  pOut(p){ return this.h/(this.lamOut(p)*1e-12); },
  /* угол отдачи электрона из сохранения импульса */
  phiElectron(p){
    const th=p.ang*Math.PI/180, p1=this.pIn(p), p2=this.pOut(p);
    const px=p1-p2*Math.cos(th), py=-p2*Math.sin(th);
    return Math.atan2(py,px)*180/Math.PI;
  },
  E0:[-0.2,1.4], LS:3.0,
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  dragPoints(p){ const a=p.ang*Math.PI/180; return [{x:this.E0[0]+this.LS*Math.cos(a), y:this.E0[1]+this.LS*Math.sin(a)}]; },
  dragMove(p,idx,x,y){ p.ang=clamp(Math.round(Math.atan2(Math.abs(y-this.E0[1]),x-this.E0[0])*180/Math.PI),0,180); },
  anchors(s,p){ return [{x:this.E0[0],y:this.E0[1]}]; },
  readouts(s,p){
    return [['длина волны до удара λ',p.lam,'пм'],
      ['угол рассеяния θ',p.ang,'°'],
      ['комптоновская длина λC = h/mc',this.lamC(),'пм'],
      ['сдвиг Δλ = λC(1 − cosθ)',this.dLam(p),'пм'],
      ['длина волны после λ′',this.lamOut(p),'пм'],
      ['энергия фотона до',this.Ein(p),'кэВ'],
      ['энергия фотона после',this.Eout(p),'кэВ'],
      ['энергия электрона отдачи',this.Eelectron(p),'кэВ'],
      ['проверка сохранения энергии',this.Eout(p)+this.Eelectron(p),'кэВ'],
      ['угол отдачи электрона φ (по другую сторону оси)',Math.abs(this.phiElectron(p)),'°'],
      ['импульс фотона до p = h/λ',this.pIn(p)*1e24,'·10⁻²⁴ кг·м/с']];
  },
  graphs:[],
  presets:[
    {name:'Рассеяние на 90°: Δλ = λC',values:{lam:20,ang:90}},
    {name:'Назад (180°): сдвиг максимален',values:{lam:20,ang:180}},
    {name:'Вперёд (0°): сдвига нет',values:{lam:20,ang:0}},
    {name:'Жёсткий рентген — электрону достаётся много',values:{lam:3,ang:120}},
    {name:'Длинная волна — сдвиг почти незаметен',values:{lam:100,ang:90}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0.05); },
  lamS(l){ return clamp(0.03*l,0.2,1.3); },
  draw(ctx,s,v,p){
    const meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3'), acc=v.c('--accent');
    const th=p.ang*Math.PI/180, phi=this.phiElectron(p)*Math.PI/180, [ex,ey]=this.E0, LS=this.LS;
    const Ke=this.Eelectron(p), pe=Math.hypot(this.pIn(p)-this.pOut(p)*Math.cos(th),this.pOut(p)*Math.sin(th))/this.pIn(p);
    const LE=clamp(0.7+1.3*pe,0.7,2.4);           // путь электрона на картинке — по его импульсу
    const T=4.2, u=(s.t%T)/T, ph=s.t*9;
    // направляющие: откуда пришёл фотон, куда ушёл он и куда электрон
    КС.пунктир(ctx,v,-6.2,ey,ex,ey,ink3,.3);
    КС.пунктир(ctx,v,ex,ey,ex+LS+0.4,ey,ink3,.18);
    КС.пунктир(ctx,v,ex,ey,ex+LS*Math.cos(th),ey+LS*Math.sin(th),sec,.45);
    if(Ke>1e-6) КС.пунктир(ctx,v,ex,ey,ex+LE*Math.cos(phi),ey+LE*Math.sin(phi),meas,.45);
    if(p.ang>0.5){ КС.дуга(ctx,v,ex,ey,0,th,0.75,sec); v.label(ctx,`θ = ${p.ang}°`,ex+0.95*Math.cos(th/2),ey+0.95*Math.sin(th/2),2,-2,sec); }
    if(Ke>1e-6 && Math.abs(phi)>0.01){ КС.дуга(ctx,v,ex,ey,phi,0,1.05,meas);
      v.label(ctx,`φ = ${Math.abs(phi*180/Math.PI).toFixed(0)}°`,ex+1.25*Math.cos(phi/2),ey+1.25*Math.sin(phi/2),2,6,meas); }
    // 1) фотон летит к покоящемуся электрону; 2) вспышка удара; 3) разлёт
    let эл=[ex,ey];
    if(u<0.45){
      const w=u/0.45, xc=-5.4+(ex-0.55+5.4)*w;
      КС.пакет(ctx,v,xc,ey,0,this.lamS(p.lam),0.26,0.5,ph,dang,2.2);
    } else if(u<0.55){
      const w=(u-0.45)/0.1;
      ctx.fillStyle=v.c('--warn')||'#e0a020'; ctx.globalAlpha=0.55*(1-w);
      ctx.beginPath(); ctx.arc(ex,ey,0.25+0.6*w,0,7); ctx.fill(); ctx.globalAlpha=1;
    }
    if(u>=0.5){
      const w=(u-0.5)/0.5, d=0.6+(LS-0.6)*w;
      КС.пакет(ctx,v,ex+d*Math.cos(th),ey+d*Math.sin(th),th,this.lamS(this.lamOut(p)),0.26,0.5,ph,sec,2.2);
      if(Ke>1e-6) эл=[ex+LE*w*Math.cos(phi),ey+LE*w*Math.sin(phi)];
    }
    КС.точка(ctx,v,эл[0],эл[1],7,meas);
    v.text(ctx,'e⁻',эл[0],эл[1],'#fff',9,'center',true);
    // подписи на концах путей
    v.label(ctx,`фотон: λ = ${p.lam} пм, E = ${this.Ein(p).toFixed(1)} кэВ`,-6.1,ey,0,-18,dang);
    { const qx=ex+LS*Math.cos(th), qy=ey+LS*Math.sin(th);
      v.label(ctx,`λ′ = ${this.lamOut(p).toFixed(2)} пм, E′ = ${this.Eout(p).toFixed(1)} кэВ`,qx,qy,Math.cos(th)<-0.3?-10:-60,-14,sec); }
    if(Ke>1e-6){ const qx=ex+LE*Math.cos(phi), qy=ey+LE*Math.sin(phi);
      v.label(ctx,`электрон отдачи: ${Ke.toFixed(2)} кэВ`,qx,qy,8,10,meas); }
    else v.label(ctx,'θ = 0: фотон не отклонился — электрону ничего не досталось',ex,ey,-150,-40,ink3);

    // график Δλ(θ)
    if(p.graph){
      const gx=-6.25, gy=2.75, gw=3.3, gh=2.2, mx=2*this.lamC();
      КС.рамка(ctx,v,gx,gy,gw,gh,'Δλ = λC(1 − cos θ)');
      v.text(ctx,`сейчас ${this.dLam(p).toFixed(3)} пм`,gx+0.18,gy+gh-0.66,sec,10,'left');
      const X=a=>gx+0.3+(gw-0.5)*a/Math.PI, Y=d=>gy+0.35+(gh-1.25)*d/mx;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X(0),Y(0)); ctx.lineTo(X(Math.PI),Y(0)); ctx.stroke();
      ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      for(let i=0;i<=60;i++){ const a=i/60*Math.PI, yy=Y(this.lamC()*(1-Math.cos(a))); i?ctx.lineTo(X(a),yy):ctx.moveTo(X(a),yy); }
      ctx.stroke();
      КС.точка(ctx,v,X(th),Y(this.dLam(p)),3.5,sec);
      v.text(ctx,'0°',X(0),gy+0.14,ink3,9); v.text(ctx,'180°',X(Math.PI),gy+0.14,ink3,9);
    }
    // баланс энергии
    if(p.bars){
      const bx=-6.25, by=-4.95, bw=6.1, bh=3.5, x0=bx+1.45, W=bw-1.7, Ein=this.Ein(p);
      КС.рамка(ctx,v,bx,by,bw,bh,'Энергия сохраняется');
      const полоса=(x,y,w,col,txt,txtCol)=>{ ctx.fillStyle=col; ctx.globalAlpha=.85; ctx.fillRect(x,y-0.22,Math.max(w,0.04),0.44); ctx.globalAlpha=1;
        if(txt) v.text(ctx,txt,x+0.08,y,txtCol||'#fff',10,'left',true); };
      v.text(ctx,'до',bx+0.2,by+2.35,ink,11,'left',true);
      полоса(x0,by+2.35,W,dang,`фотон ${Ein.toFixed(1)} кэВ`);
      v.text(ctx,'после',bx+0.2,by+1.35,ink,11,'left',true);
      const w1=W*this.Eout(p)/Ein, w2=W*Ke/Ein;
      полоса(x0,by+1.35,w1,sec,w1>1.7?`фотон′ ${this.Eout(p).toFixed(1)}`:'');
      полоса(x0+w1,by+1.35,w2,meas,w2>1.4?`e⁻ ${Ke.toFixed(1)}`:'');
      if(w2<=1.4 && Ke>1e-6) v.text(ctx,`e⁻ ${Ke<0.1?Ke.toFixed(3):Ke.toFixed(1)} кэВ`,x0+w1+w2,by+1.8,meas,10,'right',true);
      v.text(ctx,Ke>1e-6?'E′ < E  ⇒  λ′ = hc/E′ длиннее λ':'удара не было — энергия та же',bx+0.2,by+0.45,ink3,10,'left');
    }
    // треугольник импульсов
    if(p.vec){
      const bx=0.15, by=-4.95, bw=6.1, bh=3.5, Lp=2.5, O=[bx+2.9,by+0.35];
      КС.рамка(ctx,v,bx,by,bw,bh,'Импульс: p⃗ = p⃗′ + p⃗ₑ');
      const q=this.pOut(p)/this.pIn(p), A=[O[0]+Lp,O[1]], B=[O[0]+Lp*q*Math.cos(th),O[1]+Lp*q*Math.sin(th)];
      v.arrow(ctx,O[0],O[1],A[0],A[1],dang); v.arrow(ctx,O[0],O[1],B[0],B[1],sec);
      if(Ke>1e-6) v.arrow(ctx,B[0],B[1],A[0],A[1],meas);
      v.text(ctx,'p⃗',(O[0]+A[0])/2,O[1]-0.2,dang,11,'center',true);
      v.text(ctx,'p⃗′',(O[0]+B[0])/2-0.2,(O[1]+B[1])/2+0.12,sec,11,'center',true);
      if(Ke>1e-6) v.text(ctx,'p⃗ₑ',(B[0]+A[0])/2+0.22,(B[1]+A[1])/2+0.1,meas,11,'center',true);
      
    }
  }
},

/* ================= ГЛ.24: ВОЛНЫ ДЕ БРОЙЛЯ И ДИФРАКЦИЯ ЭЛЕКТРОНОВ ================= */
debroglie:{
  title:'Волна де Бройля и дифракция электронов',
  /* Электроны вылетают из пушки по одному, проходят тонкий кристалл и
     попадают в экран. Куда попадёт отдельный электрон — случайно, но из
     попаданий складываются полосы там, где d·sinθ = mλ. По вертикали экран
     размечен в sinθ — поэтому полосы идут через равные промежутки λ/d. */
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'obj',label:'Что рассматриваем',type:'select',default:'e',
     options:[{v:'e',t:'Электрон'},{v:'p',t:'Протон'},{v:'ball',t:'Шарик 1 г'}]},
    {key:'U',  label:'Ускоряющее напряжение U',unit:'В',min:1,max:1000,step:1,default:100,если:p=>p.obj!=='ball'},
    {key:'vball',label:'Скорость шарика',unit:'м/с',min:0.1,max:20,step:0.1,default:5,если:p=>p.obj==='ball'},
    {key:'d',  label:'Период кристалла d',unit:'нм',min:0.05,max:0.5,step:0.01,default:0.2},

    {type:'group',label:'Показывать'},
    {key:'diff',label:'Накопление попаданий на экране',type:'check',default:true},
    {key:'wave',label:'Длина волны рядом с решёткой в одном масштабе',type:'check',default:true}
  ],
  h:6.62607015e-34, e:1.602176634e-19, me:9.1093837015e-31, mp:1.67262192e-27,
  mass(p){ return p.obj==='e'? this.me : (p.obj==='p'? this.mp : 1e-3); },
  /* импульс: для заряженных из eU = p²/2m, для шарика p = mv */
  p(p){
    if(p.obj==='ball') return this.mass(p)*p.vball;
    return Math.sqrt(2*this.mass(p)*this.e*p.U);
  },
  /* длина волны де Бройля: λ = h/p */
  lam(p){ return this.h/this.p(p); },
  lamNm(p){ return this.lam(p)*1e9; },
  speed(p){ return p.obj==='ball'? p.vball : this.p(p)/this.mass(p); },
  /* дифракция на кристалле: d·sinθ = mλ */
  angles(p){
    const lam=this.lam(p), d=p.d*1e-9, out=[];
    for(let m=1;m<=4;m++){ const s=m*lam/d; if(s<=1) out.push({m,th:Math.asin(s)}); }
    return out;
  },
  /* дифракция наблюдаема, если λ соизмерима с периодом решётки: слишком малая λ
     даёт углы, неотличимые от нуля (случай макроскопических тел) */
  visible(p){ const r=this.lam(p)/(p.d*1e-9); return r<=1 && r>1e-3; },
  BINS:72, XC:-1.0, XS:4.45, YS:3.3,
  init(p){ return {t:0,seed:24011927,летят:[],bins:new Array(this.BINS).fill(0),hits:[],N:0,копилка:0,__stop:null}; },
  /* куда уйдёт электрон: sinθ разыгрывается около максимумов mλ/d, веса
     максимумов спадают с номером; у шарика — одно пятно */
  разыграть(s,p){
    const r=this.lam(p)/(p.d*1e-9);
    if(!this.visible(p)) return clamp(КС.гаусс(s)*0.012,-1,1);
    const ms=[{m:0,w:1}];
    for(let m=1;m<=4;m++) if(m*r<=0.97){ const w=[0,0.6,0.28,0.12,0.06][m]; ms.push({m,w},{m:-m,w}); }
    let tot=ms.reduce((a,x)=>a+x.w,0), q=КС.rnd(s)*tot, pick=ms[0];
    for(const x of ms){ q-=x.w; if(q<=0){ pick=x; break; } }
    return clamp(pick.m*r+КС.гаусс(s)*0.028,-0.999,0.999);
  },
  step(s,dt,p){
    s.t+=dt;
    if(!p.diff){ s.летят.length=0; return; }
    s.копилка+=dt*14;                                   // электронов в секунду
    while(s.копилка>=1){ s.копилка-=1;
      s.летят.push({x:-5.0,y:(КС.rnd(s)-0.5)*0.22,sn:this.разыграть(s,p)}); }
    const V=5.2;
    for(const e of s.летят){
      if(e.x<this.XC){ e.x=Math.min(this.XC,e.x+V*dt); if(e.x>=this.XC){ e.y0=e.y; } }
      else { const L=Math.hypot(this.XS-this.XC,this.YS*e.sn-e.y0), f=V*dt/L;
        e.x+=(this.XS-this.XC)*f; e.y+=(this.YS*e.sn-e.y0)*f; if(e.x>=this.XS) e.done=true; }
    }
    for(const e of s.летят) if(e.done){
      const b=Math.floor((e.sn+1)/2*this.BINS); if(b>=0&&b<this.BINS) s.bins[b]++;
      s.N++; s.hits.push([e.sn,КС.rnd(s)]); if(s.hits.length>700) s.hits.shift();
    }
    s.летят=s.летят.filter(e=>!e.done);
  },
  anchors(s,p){ return [{x:this.XC,y:0}]; },
  readouts(s,p){
    const lam=this.lamNm(p), nm={e:'электрон',p:'протон',ball:'шарик 1 г'}[p.obj];
    const out=[['объект',nm,''],
      ['масса',this.mass(p),'кг'],
      ['скорость',this.speed(p),'м/с'],
      ['импульс p',this.p(p),'кг·м/с'],
      ['длина волны λ = h/p',lam,'нм']];
    if(p.obj!=='ball') out.push(['энергия eU',p.U,'эВ']);
    out.push(['период кристалла d',p.d,'нм'],
      ['отношение λ/d',this.lam(p)/(p.d*1e-9),'']);
    if(this.visible(p)){
      for(const a of this.angles(p)) out.push([`максимум m = ${a.m}: угол`,a.th*180/Math.PI,'°']);
    } else {
      out.push(['дифракция','нет','λ слишком мала — волновые свойства незаметны']);
    }
    out.push(['электронов долетело до экрана',s.N,'']);
    return out;
  },
  graphs:[],
  presets:[
    {name:'Электрон 100 В: λ ≈ 0,12 нм',values:{obj:'e',U:100,d:0.2}},
    {name:'Электрон 40 В, d = 0,3 нм — полосы реже',values:{obj:'e',U:40,d:0.3}},
    {name:'Электрон 1000 В — волна короче, полосы теснее',values:{obj:'e',U:1000,d:0.2}},
    {name:'Протон при том же напряжении',values:{obj:'p',U:100,d:0.2}},
    {name:'Шарик: волна невообразимо мала',values:{obj:'ball',vball:5,d:0.2}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10,0,0.1); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const lam=this.lamNm(p), vis=this.visible(p), r=this.lam(p)/(p.d*1e-9), XC=this.XC, XS=this.XS, YS=this.YS;
    // пушка: катод, анод с отверстием, напряжение
    ctx.fillStyle=ink; ctx.fillRect(-6.1,-0.55,0.35,1.1);
    ctx.fillRect(-5.25,-0.9,0.12,0.72); ctx.fillRect(-5.25,0.18,0.12,0.72);
    v.text(ctx,p.obj==='ball'?'бросок':`U = ${p.U} В`,-5.6,-1.2,ink3,10);
    v.text(ctx,{e:'электроны',p:'протоны',ball:'шарики'}[p.obj],-5.6,1.2,ink3,10);
    // кристалл: тонкая плёнка, атомы с шагом d
    const n=9, dy=0.5;
    for(let i=0;i<n;i++) for(let j=0;j<2;j++) КС.точка(ctx,v,XC+j*0.22,(i-(n-1)/2)*dy,3.2,ink3);
    { const ya=0, yb=dy, mx=XC+0.55;
      v.arrow(ctx,mx,ya,mx,yb,meas); v.arrow(ctx,mx,yb,mx,ya,meas);
      v.text(ctx,`d = ${p.d} нм`,mx+0.12,yb/2,meas,10,'left'); }
    v.text(ctx,'кристалл',XC+0.1,-(n-1)/2*dy-0.45,ink3,10);
    // экран, отметки ожидаемых максимумов
    ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3); ctx.beginPath(); ctx.moveTo(XS,-YS-0.15); ctx.lineTo(XS,YS+0.15); ctx.stroke();
    if(vis) for(let m=-4;m<=4;m++){ const sn=m*r; if(Math.abs(sn)>0.97) continue;
      КС.пунктир(ctx,v,XC,0,XS,YS*sn,sec,.18);
      v.text(ctx,m===0?'0':(m>0?'+':'−')+Math.abs(m),XS-0.22,YS*sn,sec,9,'right'); }
    v.text(ctx,'экран (по высоте — sin θ)',XS,YS+0.45,ink3,10);
    // летящие частицы
    for(const e of s.летят) КС.точка(ctx,v,e.x,e.y,2.6,dang);
    // попадания и гистограмма
    for(const [sn,q] of s.hits){ ctx.fillStyle=dang; ctx.globalAlpha=.55; ctx.fillRect(XS+0.08+q*0.35,YS*sn-0.02,0.05,0.04); }
    ctx.globalAlpha=1;
    const mx=Math.max(4,...s.bins), bh=2*YS/this.BINS;
    ctx.fillStyle=acc;
    for(let b=0;b<this.BINS;b++) if(s.bins[b]){ const y=-YS+b*bh; ctx.globalAlpha=.75; ctx.fillRect(XS+0.55,y,1.2*s.bins[b]/mx,bh*0.9); }
    ctx.globalAlpha=1;
    v.text(ctx,`попаданий: ${s.N}`,XS+1.0,-YS-0.35,ink3,10);
    // волна и решётка в одном масштабе
    if(p.wave){
      const gx=-6.25, gy=2.55, gw=4.9, gh=1.95;
      КС.рамка(ctx,v,gx,gy,gw,gh,'шаг решётки d и волна λ');
      const D=0.95, y0=gy+0.72;                        // D — шаг решётки на картинке
      for(let i=0;i<=4;i++) КС.точка(ctx,v,gx+0.35+i*D,y0-0.3,3,ink3);
      const L=D*r;                                       // длина волны на картинке
      ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
      if(L>0.03){ for(let i=0;i<=200;i++){ const x=gx+0.35+4.1*i/200, y=y0+0.3+0.18*Math.sin(2*Math.PI*(x-gx)/L-s.t*6); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } }
      else { ctx.moveTo(gx+0.35,y0+0.3); ctx.lineTo(gx+4.45,y0+0.3); }
      ctx.stroke();
      v.text(ctx,L>0.03?`λ = ${lam.toFixed(4)} нм`:`λ ≈ ${числоНаСцене(lam)} нм — в ${числоНаСцене(1/r,1)} раз меньше d`,gx+0.2,gy+0.2,dang,10,'left');
    }
    // пояснение внизу
    const [t1,t2]=vis?['каждый электрон — одна точка,','а вместе точки ложатся полосами: d·sin θ = mλ']
      :(r>1?['λ больше d:','кроме центрального, максимумов нет']
          :['одно пятно: волна шарика несоизмеримо мала,','волновые свойства не видны']);
    v.text(ctx,t1,0,-YS-0.75,ink,11,'center',true);
    v.text(ctx,t2,0,-YS-1.15,ink,11,'center',true);
    v.text(ctx,`λ = h/p = ${lam<1e-6?числоНаСцене(lam,3):lam.toFixed(4)} нм,  p = ${числоНаСцене(this.p(p),3)} кг·м/с`,0,-YS-1.6,ink3,10);
  }
},

/* ================== ГЛ.25: ВОЛНОВОЙ ПАКЕТ И НЕОПРЕДЕЛЁННОСТЬ =================
   Свободный гауссов пакет электрона по точной формуле:
     σ(t) = σ₀·√(1 + (t/τ)²),   τ = 2mσ₀²/ħ.
   Координата в нанометрах, время в фемтосекундах: ħ/m = 0,1158 нм²/фс.
   Узкий пакет (малое Δx) несёт широкий набор импульсов Δp = ħ/2Δx, его
   части разбегаются с разными скоростями — и он расплывается быстро.
   Широкий пакет почти не расплывается. Распределение импульсов у свободной
   частицы со временем не меняется. */
uncertainty:{
  title:'Волновой пакет и принцип неопределённости',
  schema:true,
  hudAware:true,
  timeUnit:'фс',
  params:[
    {key:'dx',label:'Начальная ширина пакета Δx',unit:'нм',min:0.05,max:2,step:0.01,default:0.5},
    {key:'p0',label:'Средний импульс: волновое число k₀ = p/ħ',unit:'нм⁻¹',min:0,max:20,step:0.5,default:8},

    {type:'group',label:'Показывать'},
    {key:'spec', label:'Распределение импульсов',type:'check',default:true},
    {key:'parts',label:'Пять волн, из которых сложен пакет',type:'check',default:false},
    {key:'auto', label:'Пакет летит и расплывается',type:'check',default:true}
  ],
  hbar:1.054571817e-34, h:6.62607015e-34, me:9.1093837015e-31,
  HM:0.115767,                                        // ħ/m электрона, нм²/фс
  /* для гауссова пакета принцип неопределённости выполняется как равенство:
     Δx·Δp = ħ/2 — это минимально возможное произведение */
  dp(p){ return this.hbar/(2*p.dx*1e-9); },
  product(p){ return (p.dx*1e-9)*this.dp(p); },
  /* разброс скорости электрона, отвечающий Δp */
  dv(p){ return this.dp(p)/this.me; },
  tau(p){ return 2*p.dx*p.dx/this.HM; },              // фс
  sig(p,t){ const a=t/this.tau(p); return p.dx*Math.sqrt(1+a*a); },
  x0(p){ return p.p0>0?-3.6:0; },
  центр(p,t){ return this.x0(p)+this.HM*p.p0*t; },
  /* ψ(x,t) свободного пакета: [Re ψ, |ψ|²], обе — в долях начального максимума */
  psi(p,x,t){
    const a=t/this.tau(p), X=x-this.центр(p,t), s2=p.dx*p.dx*(1+a*a);
    const rho=Math.exp(-X*X/(2*s2))/Math.sqrt(1+a*a);
    const ph=p.p0*X+0.5*this.HM*p.p0*p.p0*t+a*X*X/(4*s2)-0.5*Math.atan(a);
    return [Math.sqrt(rho)*Math.cos(ph),rho];
  },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){
    if(!p.auto) return;
    s.t+=dt;
    if(this.центр(p,s.t)>6.6 || s.t>40 || this.sig(p,s.t)>6){
      s.__stop=this.sig(p,s.t)>6?'Пакет расплылся на весь кадр — «Сначала», чтобы повторить':'Пакет ушёл за край кадра — «Сначала», чтобы повторить'; }
  },
  anchors(s,p){ return [{x:0.95*this.центр(p,s.t),y:1.9}]; },
  readouts(s,p){
    return [['ширина пакета Δx',p.dx,'нм'],
      ['разброс импульса Δp',this.dp(p)*1e24,'·10⁻²⁴ кг·м/с'],
      ['произведение Δx·Δp',this.product(p)*1e34,'·10⁻³⁴'],
      ['предел ħ/2',this.hbar/2*1e34,'·10⁻³⁴'],
      ['во сколько раз больше предела',this.product(p)/(this.hbar/2),''],
      ['разброс скорости электрона',this.dv(p)/1e3,'км/с'],
      ['ширина сейчас Δx(t)',this.sig(p,s.t),'нм'],
      ['время расплывания τ = 2mΔx²/ħ',this.tau(p),'фс'],
      ['вывод',p.dx<0.2?'координата задана точно — импульс размыт сильно'
        :(p.dx>1.2?'импульс задан точно — координата размыта сильно':'промежуточный случай'),'']];
  },
  graphs:[
    {label:'Ширина пакета Δx(t)',unit:'нм',series:['Δx'],get(s,p){ return [SIMS.uncertainty.sig(p,s.t),null]; }}
  ],
  presets:[
    {name:'Узкий пакет: где — знаем, куда летит — нет',values:{dx:0.1,p0:8}},
    {name:'Широкий пакет почти не расплывается',values:{dx:1.6,p0:8}},
    {name:'Промежуточный случай',values:{dx:0.5,p0:8}},
    {name:'Стоящий пакет (k₀ = 0) просто расплывается',values:{dx:0.3,p0:0}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const t=s.t, SX=0.95, X=x=>x*SX, yb=1.9, c=this.центр(p,t), σ=this.sig(p,t);
    // ---- координата
    КС.рамка(ctx,v,-6.25,0.1,12.5,4.75,'координата: где частицу можно найти');
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(-5.9,yb); ctx.lineTo(5.9,yb); ctx.stroke();
    for(let k=-6;k<=6;k+=2){ ctx.beginPath(); ctx.moveTo(X(k),yb-0.06); ctx.lineTo(X(k),yb+0.06); ctx.stroke(); v.text(ctx,`${k}`,X(k),yb-0.22,ink3,9); }
    v.text(ctx,'x, нм',5.95,yb+0.2,ink3,9,'right');
    if(p.parts){
      const dk=1/(2*p.dx);
      for(let j=-2;j<=2;j++){ const k=p.p0+j*dk, w=Math.exp(-j*j/2);
        ctx.strokeStyle=sec; ctx.globalAlpha=0.12+0.25*w; ctx.lineWidth=v.lw(1); ctx.beginPath();
        for(let i=0;i<=300;i++){ const x=-6.2+12.4*i/300, y=yb+0.9*w*Math.cos(k*(x-c)); i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); }
        ctx.stroke(); }
      ctx.globalAlpha=1;
    }
    // |ψ|² — заливка, Re ψ — линия
    ctx.fillStyle=acc; ctx.globalAlpha=.22; ctx.beginPath(); ctx.moveTo(X(-6.2),yb);
    for(let i=0;i<=400;i++){ const x=-6.2+12.4*i/400; ctx.lineTo(X(x),yb+2.55*this.psi(p,x,t)[1]); }
    ctx.lineTo(X(6.2),yb); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
    ctx.strokeStyle=acc; ctx.lineWidth=v.lw(1.4); ctx.beginPath();
    for(let i=0;i<=400;i++){ const x=-6.2+12.4*i/400, y=yb+2.55*this.psi(p,x,t)[1]; i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); }
    ctx.stroke();
    ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.7); ctx.beginPath();
    for(let i=0;i<=700;i++){ const x=-6.2+12.4*i/700, y=yb+1.3*this.psi(p,x,t)[0]; i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); }
    ctx.stroke();
    // начальный профиль, перенесённый в текущий центр, — для сравнения
    if(t>0.05){ ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.1); ctx.beginPath();
      for(let i=0;i<=200;i++){ const x=c-4*p.dx+8*p.dx*i/200, y=yb+2.55*Math.exp(-(x-c)*(x-c)/(2*p.dx*p.dx)); i?ctx.lineTo(X(x),y):ctx.moveTo(X(x),y); }
      ctx.stroke(); ctx.restore(); }
    // Δx(t)
    { const y=0.45, a=X(c-σ), b=X(c+σ);
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(a,y); ctx.lineTo(b,y); ctx.stroke();
      if(b-a>0.2){ v.arrow(ctx,(a+b)/2,y,a,y,meas); v.arrow(ctx,(a+b)/2,y,b,y,meas); }
      v.text(ctx,`Δx(t) = ${σ.toFixed(2)} нм`,clamp((a+b)/2,-4.6,4.6),y+0.25,meas,10,'center',true); }
    v.text(ctx,'— Re ψ',-5.95,4.1,dang,10,'left',true);
    v.text(ctx,'▇ |ψ|²',-5.95,3.75,acc,10,'left',true);
    if(t>0.05) v.text(ctx,'- - было при t = 0',-5.95,3.4,ink3,10,'left');
    // ---- импульс
    if(p.spec){
      const gy=-4.95, gh=3.95, yb2=gy+0.75, dk=1/(2*p.dx), K=k=>(k-p.p0)*0.46;
      КС.рамка(ctx,v,-6.25,gy,12.5,gh,'импульс: какие p = ħk входят в пакет (со временем не меняется)');
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(-5.9,yb2); ctx.lineTo(5.9,yb2); ctx.stroke();
      for(let j=-12;j<=12;j+=4){ const k=p.p0+j; v.text(ctx,`${k}`,K(k),yb2-0.22,ink3,9); }
      v.text(ctx,'k, нм⁻¹',5.95,yb2+0.2,ink3,9,'right');
      ctx.fillStyle=sec; ctx.globalAlpha=.25; ctx.beginPath(); ctx.moveTo(-5.9,yb2);
      for(let i=0;i<=300;i++){ const x=-5.9+11.8*i/300, k=p.p0+x/0.46; ctx.lineTo(x,yb2+1.75*Math.exp(-(k-p.p0)*(k-p.p0)/(2*dk*dk))); }
      ctx.lineTo(5.9,yb2); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      const a=Math.max(-5.9,K(p.p0-dk)), b=Math.min(5.9,K(p.p0+dk)), y=yb2+1.95;
      ctx.strokeStyle=meas; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); ctx.moveTo(a,y); ctx.lineTo(b,y); ctx.stroke();
      v.arrow(ctx,(a+b)/2,y,a,y,meas); v.arrow(ctx,(a+b)/2,y,b,y,meas);
      v.text(ctx,`Δp = ħ/2Δx = ${(this.dp(p)*1e24).toFixed(2)}·10⁻²⁴ кг·м/с`,0,y+0.28,meas,10,'center',true);
      v.text(ctx,p.dx<0.3?'узкий пакет → широкий разброс скоростей → быстро расплывается'
        :(p.dx>1.2?'широкий пакет → скорости почти одинаковы → почти не расплывается'
        :'Δx·Δp = ħ/2 при t = 0; дальше Δx растёт, а Δp — нет'),0,gy+0.2,ink,10,'center');
    }
  }
},

/* ================= ГЛ.25: ЧАСТИЦА В ЯЩИКЕ =================
   Аналогия с водой в лотке: волна добегает до стенки, отражается без
   потерь и накладывается сама на себя. Устойчиво держится только такая
   картина, у которой у стенок узлы, — в длину лотка укладывается целое
   число полуволн, λ = 2L/n. Это и есть уровни частицы в ящике. Вода
   колеблется на месте — стоячая волна; частота растёт как n² (на экране
   сжата, чтобы глаз успевал). Смесь двух уровней «плещется» от стенки к
   стенке — только так частица в ящике и «движется». */
box:{
  title:'Частица в ящике: квантование энергии',
  schema:true,
  timeless:true,
  hudAware:true,
  rotate3d(p){ return !!p.d3; },
  rot0:{yaw:-0.32,pitch:0.55},
  params:[
    {key:'L',label:'Ширина ящика L',unit:'нм',min:0.2,max:3,step:0.05,default:1},
    {key:'n',label:'Номер уровня n',min:1,max:8,step:1,default:2},
    {key:'part',label:'Частица',type:'select',default:'e',
     options:[{v:'e',t:'Электрон'},{v:'p',t:'Протон'}]},

    {type:'group',label:'Показывать'},
    {key:'d3',    label:'Вода в лотке объёмно (протяните, чтобы повернуть)',type:'check',default:true},
    {key:'form',  label:'Как рождается стоячая волна: бегущая + отражённая',type:'check',default:true},
    {key:'mix',   label:'Смесь уровней n и n+1: вода плещется',type:'check',default:false},
    {key:'psi',   label:'Волновая функция ψ',type:'check',default:true},
    {key:'prob',  label:'Плотность вероятности |ψ|²',type:'check',default:true},
    {key:'levels',label:'Лестница уровней энергии',type:'check',default:true},
    {key:'auto',  label:'Волна колеблется',type:'check',default:true}
  ],
  h:6.62607015e-34, hbar:1.054571817e-34, e:1.602176634e-19,
  me:9.1093837015e-31, mp:1.67262192e-27,
  mass(p){ return p.part==='e'? this.me : this.mp; },
  /* уровни энергии: E_n = n²h²/(8mL²) */
  E(p,n){ const L=p.L*1e-9; return n*n*this.h*this.h/(8*this.mass(p)*L*L)/this.e; },   // эВ
  /* волновая функция: ψ_n(x) = √(2/L)·sin(nπx/L) */
  psiAt(p,n,x){ const L=p.L; return Math.sqrt(2/L)*Math.sin(n*Math.PI*x/L); },
  probAt(p,n,x){ const v=this.psiAt(p,n,x); return v*v; },
  /* длина волны де Бройля на уровне n: λ = 2L/n (как у стоячей волны!) */
  lam(p,n){ return 2*p.L/n; },
  nodesInside(p,n){ return n-1; },
  /* частота на экране: растёт с n, как n², но сжата, чтобы не мелькать */
  ω(n){ return 0.9*n*n/(1+n*n/25); },
  /* профиль воды (в долях): u = x/L ∈ [0,1] */
  профиль(p,u,t){
    const a=Math.sin(p.n*Math.PI*u)*Math.cos(this.ω(p.n)*t);
    if(!p.mix) return a;
    return (a+Math.sin((p.n+1)*Math.PI*u)*Math.cos(this.ω(p.n+1)*t))/1.6;
  },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ if(p.auto) s.t+=dt; },
  anchors(s,p){ return [{x:0,y:1.2}]; },
  readouts(s,p){
    const n=p.n;
    // проверка нормировки численно
    let norm=0; const N=2000;
    for(let i=0;i<N;i++){ const x=(i+0.5)*p.L/N; norm+=this.probAt(p,n,x)*(p.L/N); }
    return [['частица',p.part==='e'?'электрон':'протон',''],
      ['ширина ящика L',p.L,'нм'],
      ['номер уровня n',n,''],
      ['энергия Eₙ = n²h²/8mL²',this.E(p,n),'эВ'],
      ['энергия основного уровня E₁',this.E(p,1),'эВ'],
      ['отношение Eₙ/E₁ (должно быть n²)',this.E(p,n)/this.E(p,1),''],
      ['длина волны λ = 2L/n',this.lam(p,n),'нм'],
      ['узлов внутри ящика',this.nodesInside(p,n),''],
      ['нормировка ∫|ψ|²dx',norm,''],
      ['следующий уровень Eₙ₊₁',this.E(p,n+1),'эВ'],
      ['разность уровней',this.E(p,n+1)-this.E(p,n),'эВ']];
  },
  graphs:[],
  presets:[
    {name:'Основной уровень (n = 1): одна полуволна',values:{L:1,n:1,part:'e',mix:false}},
    {name:'Второй уровень (n = 2): узел посередине',values:{L:1,n:2,part:'e',mix:false}},
    {name:'Высокий уровень (n = 6)',values:{L:1,n:6,part:'e',mix:false}},
    {name:'Смесь n = 1 и 2: вода плещется',values:{L:1,n:1,part:'e',mix:true}},
    {name:'Узкий ящик — уровни разъезжаются',values:{L:0.3,n:1,part:'e',mix:false}},
    {name:'Протон: та же формула, энергии меньше',values:{L:1,n:1,part:'p',mix:false}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const t=s.t, n=p.n, LX=6.0, X0=-5.6, вода='#3b82c4';
    const Xs=u=>X0+LX*u;                                        // u ∈ [0,1] → сцена
    // ---- лоток с водой
    if(p.d3){
      const пр0=v.p3(), OY=1.7, пр=(x,y,z)=>{ const q=пр0(x,y,z); return [q[0]-0.9,q[1]+OY,q[2]]; };
      const W=0.75, D=1.0, A=0.62, NX=60;
      const z=(u,tt)=>A*this.профиль(p,u,tt);
      // дно и дальняя стенка
      const face=(pts,fill,alpha,stroke)=>{ ctx.beginPath(); pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath();
        if(fill){ ctx.fillStyle=fill; ctx.globalAlpha=alpha; ctx.fill(); ctx.globalAlpha=1; }
        if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=v.lw(1); ctx.stroke(); } };
      const xL=-LX/2, xR=LX/2;
      face([пр(xL,-W,-D),пр(xR,-W,-D),пр(xR,W,-D),пр(xL,W,-D)],ink3,.08,ink3);
      const передY = пр(0,W,0)[2]>пр(0,-W,0)[2] ? W : -W;           // какая длинная стенка ближе к зрителю
      // боковая грань воды у дальней стенки
      const бок=(y,alpha)=>{ const pts=[]; for(let i=0;i<=NX;i++){ const u=i/NX; pts.push(пр(xL+LX*u,y,z(u,t))); }
        pts.push(пр(xR,y,-D),пр(xL,y,-D)); face(pts,вода,alpha,null);
        ctx.strokeStyle=вода; ctx.lineWidth=v.lw(1.8); ctx.beginPath();
        for(let i=0;i<=NX;i++){ const q=pts[i]; i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]); } ctx.stroke(); };
      бок(-передY,.18);
      // поверхность: полосы поперёк лотка, от дальних к ближним
      const полосы=[];
      for(let i=0;i<NX;i++){ const u0=i/NX, u1=(i+1)/NX, z0=z(u0,t), z1=z(u1,t);
        const q=[пр(xL+LX*u0,-W,z0),пр(xL+LX*u1,-W,z1),пр(xL+LX*u1,W,z1),пр(xL+LX*u0,W,z0)];
        полосы.push({q,d:(q[0][2]+q[2][2])/2,наклон:(z1-z0)*NX/LX}); }
      полосы.sort((a,b)=>a.d-b.d);
      for(const f of полосы){ const light=clamp(0.55-0.35*f.наклон,0.15,0.95);
        ctx.fillStyle=`rgba(${Math.round(40+120*light)},${Math.round(110+100*light)},${Math.round(190+60*light)},0.9)`;
        ctx.beginPath(); f.q.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])); ctx.closePath(); ctx.fill(); }
      бок(передY,.28);
      // торцевые стенки — те самые «бесконечно высокие стенки»
      for(const x of [xL,xR]) face([пр(x,-W,-D),пр(x,W,-D),пр(x,W,1.0),пр(x,-W,1.0)],ink,.22,ink);
      // уровень покоя и узлы на ближней грани
      if(!p.mix){ for(let m=0;m<=n;m++){ const q=пр(xL+LX*m/n,передY,0); КС.точка(ctx,v,q[0],q[1],3.4,ink); } }
      // подпись — под самым нижним углом лотка, при любом повороте
      const низЛотка=Math.min(...[xL,xR].map(x=>Math.min(пр(x,-W,-D)[1],пр(x,W,-D)[1])));
      v.text(ctx,`L = ${p.L} нм: в длину помещается ${n} ${n===1?'полуволна':(n<5?'полуволны':'полуволн')}`,пр(0,0,-D)[0],низЛотка-0.35,ink,10,'center',true);
      const qW=пр(xR,-передY,1.0);
      v.label(ctx,'стенка: волна отражается без потерь',qW[0],qW[1],-120,-12,ink3);
    } else {
      // вид сбоку: лоток в разрезе
      const yb=1.5, A=1.0, D=1.1;
      ctx.fillStyle=вода; ctx.globalAlpha=.35; ctx.beginPath(); ctx.moveTo(Xs(0),yb-D);
      for(let i=0;i<=200;i++){ const u=i/200; ctx.lineTo(Xs(u),yb+A*this.профиль(p,u,t)); }
      ctx.lineTo(Xs(1),yb-D); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.strokeStyle=вода; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
      for(let i=0;i<=200;i++){ const u=i/200, y=yb+A*this.профиль(p,u,t); i?ctx.lineTo(Xs(u),y):ctx.moveTo(Xs(u),y); }
      ctx.stroke();
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(3.4); ctx.beginPath();
      ctx.moveTo(Xs(0),yb+1.6); ctx.lineTo(Xs(0),yb-D); ctx.lineTo(Xs(1),yb-D); ctx.lineTo(Xs(1),yb+1.6); ctx.stroke();
      if(!p.mix) for(let m=0;m<=n;m++) КС.точка(ctx,v,Xs(m/n),yb,3.4,ink);
      v.text(ctx,`лоток длиной L = ${p.L} нм: помещается ${n} ${n===1?'полуволна':(n<5?'полуволны':'полуволн')}`,Xs(0.5),yb-D-0.3,ink,10,'center',true);
      v.label(ctx,'стенки: волна отражается без потерь',Xs(0.5),yb+1.6,-100,-8,ink3);
    }
    // ---- график: ψ, |ψ|², бегущая + отражённая
    { const gy=-4.95, gh=3.55, yb=gy+1.6, H=1.1, NX=240;
      КС.рамка(ctx,v,-6.25,gy,X0+LX+2.95+6.25,gh,p.form?'бегущая → и отражённая ← дают стоячую':'ψ и |ψ|² внутри ящика');
      ctx.strokeStyle=ink; ctx.lineWidth=v.lw(2.6); ctx.beginPath();
      ctx.moveTo(Xs(0),yb-1.25); ctx.lineTo(Xs(0),yb+1.35); ctx.moveTo(Xs(1),yb-1.25); ctx.lineTo(Xs(1),yb+1.35); ctx.stroke();
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(Xs(0),yb); ctx.lineTo(Xs(1),yb); ctx.stroke();
      const w=this.ω(n)*t, k=n*Math.PI;
      if(p.prob){ ctx.fillStyle=acc; ctx.globalAlpha=.2; ctx.beginPath(); ctx.moveTo(Xs(0),yb);
        for(let i=0;i<=NX;i++){ const u=i/NX; let r=Math.sin(k*u)**2; if(p.mix){ r=(Math.sin(k*u)**2+Math.sin((n+1)*Math.PI*u)**2+2*Math.sin(k*u)*Math.sin((n+1)*Math.PI*u)*Math.cos((this.ω(n+1)-this.ω(n))*t))/2.6; }
          ctx.lineTo(Xs(u),yb+H*r); }
        ctx.lineTo(Xs(1),yb); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; }
      if(p.form && !p.mix){
        for(const [sg,col] of [[-1,dang],[1,sec]]){
          ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.strokeStyle=col; ctx.lineWidth=v.lw(1.3); ctx.beginPath();
          for(let i=0;i<=NX;i++){ const u=i/NX, y=yb+0.5*H*Math.sin(k*u+sg*w); i?ctx.lineTo(Xs(u),y):ctx.moveTo(Xs(u),y); }
          ctx.stroke(); ctx.restore(); }
        v.text(ctx,'бегущая →',Xs(1)+0.15,yb+0.5,dang,10,'left',true);
        v.text(ctx,'← отражённая',Xs(1)+0.15,yb+0.1,sec,10,'left',true);
        v.text(ctx,'сумма — стоит',Xs(1)+0.15,yb-0.3,вода,10,'left',true);
      }
      if(p.psi){ ctx.strokeStyle=p.form?вода:dang; ctx.lineWidth=v.lw(2.2); ctx.beginPath();
        for(let i=0;i<=NX;i++){ const u=i/NX, y=yb+H*this.профиль(p,u,t); i?ctx.lineTo(Xs(u),y):ctx.moveTo(Xs(u),y); }
        ctx.stroke(); }
      if(!p.mix) for(let m=1;m<n;m++) КС.точка(ctx,v,Xs(m/n),yb,3,ink);
      v.text(ctx,p.mix?'смесь уровней: горб |ψ|² ходит от стенки к стенке':
        `узлы стоят на месте; |ψ|² от времени не зависит`,(X0+LX+2.95-6.25)/2,gy+0.22,ink3,10,'center');
    }
    // ---- лестница уровней
    if(p.levels){
      const top=Math.max(n+(p.mix?2:1),4), gx=4.45, gy=-4.95, gw=1.8, gh=3.55, Em=this.E(p,top), Y=E=>gy+0.5+(gh-1.25)*E/Em;
      КС.рамка(ctx,v,gx,gy,gw,gh,'E');
      for(let k=1;k<=top;k++){ const y=Y(this.E(p,k)), on=(k===n)||(p.mix&&k===n+1);
        ctx.strokeStyle=on?dang:ink3; ctx.globalAlpha=on?1:.55; ctx.lineWidth=v.lw(on?2.6:1.2);
        ctx.beginPath(); ctx.moveTo(gx+0.2,y); ctx.lineTo(gx+(on?1.2:0.9),y); ctx.stroke(); ctx.globalAlpha=1;
        if(k<=2||on||k===top) v.text(ctx,`n=${k}`,gx+1.3,y,on?dang:ink3,9,'left',on); }
      v.text(ctx,'Eₙ ∝ n²',gx+gw/2,gy+0.22,ink3,10);
      v.text(ctx,`${this.E(p,n)<0.01?числоНаСцене(this.E(p,n),3):this.E(p,n).toFixed(3)} эВ`,gx+gw-0.12,gy+gh-0.28,dang,9,'right');
    }
  }
},

/* ================= ГЛ.26: СПЕКТР ВОДОРОДА =================
   Слева — уровни атома в честном масштабе энергии: наверху они сгущаются
   к нулю. Электрон падает с уровня на уровень, вылетает фотон и летит в
   спектроскоп справа — туда, где на шкале длин волн стоит его линия.
   Шкала логарифмическая: на ней помещаются и ультрафиолет (Лайман), и
   видимые линии (Бальмер), и инфракрасные (Пашен). Под ней — то, что видно
   глазом в спектроскопе: при испускании — яркие линии на тёмном, при
   поглощении — тёмные провалы на радуге. */
hspectrum:{
  title:'Спектр водорода: испускание и поглощение',
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'proc',label:'Процесс',type:'select',default:'emit',
     options:[{v:'emit',t:'Спонтанное испускание'},
              {v:'absorb',t:'Поглощение фотона'},
              {v:'stim',t:'Вынужденное испускание (лазер)'}]},
    {key:'ni',label:'Верхний уровень',min:2,max:8,step:1,default:3},
    {key:'nf',label:'Нижний уровень',min:1,max:7,step:1,default:2},

    {type:'group',label:'Показывать'},
    {key:'series',label:'Все переходы серий Лаймана, Бальмера, Пашена',type:'check',default:true},
    {key:'scale', label:'Весь спектр на логарифмической шкале',type:'check',default:true}
  ],
  E1:-13.605693, R:1.0973731568e7, h:6.62607015e-34, c:2.99792458e8, e:1.602176634e-19,
  E(n){ return this.E1/(n*n); },
  hi(p){ return Math.max(p.ni,p.nf+1); },              // верхний всегда выше нижнего
  lo(p){ return Math.min(p.nf,p.ni-1); },
  /* энергия фотона при переходе: ΔE = E_hi − E_lo */
  dE(p){ return this.E(this.hi(p))-this.E(this.lo(p)); },
  /* длина волны: λ = hc/ΔE, и то же по формуле Ридберга 1/λ = R(1/n₁² − 1/n₂²) */
  lamNm(p){ return this.h*this.c/(this.dE(p)*this.e)*1e9; },
  lamRydberg(p){
    const lo=this.lo(p), hi=this.hi(p);
    return 1/(this.R*(1/(lo*lo)-1/(hi*hi)))*1e9;
  },
  lamOf(hi,lo){ return 1/(this.R*(1/(lo*lo)-1/(hi*hi)))*1e9; },
  freq(p){ return this.dE(p)*this.e/this.h; },
  seriesName(p){
    const lo=this.lo(p);
    return ({1:'Лаймана (ультрафиолет)',2:'Бальмера (видимый свет)',3:'Пашена (инфракрасный)',
             4:'Брэкета',5:'Пфунда'})[lo] || `серия n=${lo}`;
  },
  visible(p){ const l=this.lamNm(p); return l>=380&&l<=750; },
  init(p){ return {t:0,__stop:null}; },
  step(s,dt,p){ s.t+=dt; },
  anchors(s,p){ return [{x:-3.6,y:0}]; },
  readouts(s,p){
    const hi=this.hi(p), lo=this.lo(p);
    return [['процесс',{emit:'спонтанное испускание',absorb:'поглощение',stim:'вынужденное испускание'}[p.proc],''],
      ['верхний уровень',hi,''],
      ['нижний уровень',lo,''],
      ['энергия верхнего',this.E(hi),'эВ'],
      ['энергия нижнего',this.E(lo),'эВ'],
      ['энергия фотона ΔE',this.dE(p),'эВ'],
      ['длина волны λ = hc/ΔE',this.lamNm(p),'нм'],
      ['по формуле Ридберга',this.lamRydberg(p),'нм'],
      ['частота',this.freq(p)/1e12,'ТГц'],
      ['серия',this.seriesName(p),''],
      ['виден ли глазом',this.visible(p)?1:0,this.visible(p)?'да':'нет'],
      ['фотонов на выходе',p.proc==='stim'?2:(p.proc==='absorb'?0:1),'']];
  },
  graphs:[],
  presets:[
    {name:'Hα: 3→2, красная линия 656 нм',values:{proc:'emit',ni:3,nf:2}},
    {name:'Hβ: 4→2, голубая 486 нм',values:{proc:'emit',ni:4,nf:2}},
    {name:'Лайман-альфа: 2→1, ультрафиолет',values:{proc:'emit',ni:2,nf:1}},
    {name:'Серия Пашена: 4→3, инфракрасный',values:{proc:'emit',ni:4,nf:3}},
    {name:'Поглощение 2→3: тёмная линия на радуге',values:{proc:'absorb',ni:3,nf:2}},
    {name:'Вынужденное испускание: два фотона',values:{proc:'stim',ni:3,nf:2}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  /* цвет по длине волны (для совместимости со старым кодом) */
  colorOf(lam){ return КС.цветλ(lam); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const hi=this.hi(p), lo=this.lo(p), lam=this.lamNm(p), col=КС.цветλ(lam);
    const T=3.2, u=(s.t%T)/T;
    // ---- уровни
    const lx=-6.25, lw=5.5, y1=-4.1, y0=3.95, Y=E=>y1+(y0-y1)*(1-E/this.E1);
    КС.рамка(ctx,v,lx,-4.95,lw,9.9,'уровни атома водорода, эВ');
    const xs=lx+2.1, xe=lx+lw-0.2;
    ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1);
    ctx.beginPath(); ctx.moveTo(xs,Y(0)); ctx.lineTo(xe,Y(0)); ctx.stroke(); ctx.restore();
    v.text(ctx,'0 эВ: электрон свободен',xe,Y(0)+0.2,dang,9,'right');
    for(let k=1;k<=8;k++){ const y=Y(this.E(k)), on=(k===hi||k===lo);
      ctx.strokeStyle=on?ink:ink3; ctx.globalAlpha=on?1:.5; ctx.lineWidth=v.lw(on?2.2:1);
      ctx.beginPath(); ctx.moveTo(xs,y); ctx.lineTo(xe,y); ctx.stroke(); ctx.globalAlpha=1;
      if(k<=3||on) v.text(ctx,`n=${k} ${this.E(k).toFixed(2)}`,xs-0.1,y,on?ink:ink3,9,'right',on); }
    v.text(ctx,'4, 5, …',xs-0.1,Y(this.E(5))+0.05,ink3,9,'right');
    // все переходы серий — тонкими стрелками, по колонкам
    const колонка={1:xs+0.35,2:xs+1.3,3:xs+2.45};
    if(p.series){
      for(const nf of [1,2,3]){ let i=0;
        for(let ni=nf+1;ni<=6;ni++,i++){ const x=колонка[nf]+i*0.13, l=this.lamOf(ni,nf);
          ctx.globalAlpha=.35; v.arrow(ctx,x,Y(this.E(ni)),x,Y(this.E(nf))+0.04,КС.цветλ(l)); ctx.globalAlpha=1; }
        v.text(ctx,['','Лайман','Бальмер','Пашен'][nf],колонка[nf]+0.3,Y(this.E(nf))-0.25,ink3,9); }
    }
    // текущий переход
    const ax=(колонка[lo]||xs+2.9)+(p.series?0.75:0), yH=Y(this.E(hi)), yL=Y(this.E(lo));
    ctx.save(); ctx.lineWidth=v.lw(3);
    if(p.proc==='absorb') v.arrow(ctx,ax,yL,ax,yH,col); else v.arrow(ctx,ax,yH,ax,yL,col);
    ctx.restore();
    v.text(ctx,`${hi} → ${lo}: ΔE = ${this.dE(p).toFixed(3)} эВ`,lx+lw/2,-4.62,ink,10,'center',true);
    // электрон
    let ey;
    if(p.proc==='absorb') ey=u<0.45?yL:(u<0.65?yL+(yH-yL)*(u-0.45)/0.2:yH);
    else ey=u<0.35?yH:(u<0.5?yH+(yL-yH)*(u-0.35)/0.15:yL);
    КС.точка(ctx,v,ax,ey,5,meas);
    // ---- спектроскоп
    const sx=-0.55, sw=6.8;
    const LX=l=>sx+0.25+(sw-0.5)*Math.log(l/80)/Math.log(2000/80);
    let цель=null;                                      // куда летит фотон
    if(p.scale){
      const gy=2.2, gh=2.75, by=gy+1.0;
      КС.рамка(ctx,v,sx,gy,sw,gh,'весь спектр водорода, λ в нм');
      const band=(a,b,c)=>{ ctx.fillStyle=c; ctx.globalAlpha=.18; ctx.fillRect(LX(a),by-0.2,LX(b)-LX(a),1.05); ctx.globalAlpha=1; };
      band(80,380,'#7c5cc4'); band(750,2000,'#b3413a');
      for(let l=380;l<750;l+=5){ ctx.fillStyle=КС.цветλ(l); ctx.globalAlpha=.55; ctx.fillRect(LX(l),by-0.2,LX(l+5)-LX(l)+0.01,1.05); }
      ctx.globalAlpha=1;
      v.text(ctx,'УФ',LX(170),by+1.05,ink3,9); v.text(ctx,'видимый',LX(530),by+1.05,ink3,9); v.text(ctx,'ИК',LX(1300),by+1.05,ink3,9);
      for(const nf of [1,2,3]) for(let ni=nf+1;ni<=12;ni++){ const l=this.lamOf(ni,nf); if(l<80||l>2000) continue;
        ctx.strokeStyle=ink; ctx.globalAlpha=.55; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(LX(l),by-0.2); ctx.lineTo(LX(l),by+0.45); ctx.stroke(); }
      ctx.globalAlpha=1;
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(LX(80),by-0.2); ctx.lineTo(LX(2000),by-0.2); ctx.stroke();
      for(const l of [100,200,500,1000,2000]) v.text(ctx,`${l}`,LX(l),by-0.42,ink3,9);
      ctx.strokeStyle=col; ctx.lineWidth=v.lw(3.5); ctx.beginPath(); ctx.moveTo(LX(lam),by-0.2); ctx.lineTo(LX(lam),by+0.95); ctx.stroke();
      v.text(ctx,`${lam.toFixed(1)} нм`,LX(lam),by-0.74,dang,9,'center',true);
      цель=[LX(lam),by+0.3];
    }
    // что видно глазом
    { const gy=-1.0, gh=3.0, by=gy+0.45, bh=1.65, VX=l=>sx+0.3+(sw-0.6)*(l-380)/370;
      КС.рамка(ctx,v,sx,gy,sw,gh,p.proc==='absorb'?'в спектроскопе: свет прошёл через газ':'в спектроскопе: свечение газа');
      if(p.proc==='absorb'){
        for(let l=380;l<750;l+=2){ ctx.fillStyle=КС.цветλ(l); ctx.fillRect(VX(l),by,VX(l+2)-VX(l)+0.01,bh); }
        for(let k=3;k<=7;k++){ const l=this.lamOf(k,2); if(l<380) continue; ctx.fillStyle='#111'; ctx.globalAlpha=(k===hi&&lo===2)?1:.75;
          ctx.fillRect(VX(l)-0.035,by,0.07,bh); }
        ctx.globalAlpha=1;
      } else {
        ctx.fillStyle='#0d0f14'; ctx.fillRect(VX(380),by,VX(750)-VX(380),bh);
        for(let k=3;k<=7;k++){ const l=this.lamOf(k,2); if(l<380) continue; const on=(k===hi&&lo===2);
          ctx.fillStyle=КС.цветλ(l); ctx.globalAlpha=on?1:.35; ctx.fillRect(VX(l)-(on?0.05:0.03),by,on?0.1:0.06,bh); }
        ctx.globalAlpha=1;
      }
      v.text(ctx,'380',VX(380),by-0.2,ink3,9); v.text(ctx,'750 нм',VX(750),by-0.2,ink3,9);
      if(lo===2 && this.visible(p)){ if(!цель) цель=[VX(lam),by+bh/2]; }
      else { ctx.fillStyle=p.proc==='absorb'?'rgba(0,0,0,.55)':'rgba(0,0,0,0)'; ctx.fillRect(VX(380),by+bh/2-0.25,VX(750)-VX(380),0.5);
        v.text(ctx,lam<380?'эта линия — в ультрафиолете: глазом не видна':'эта линия — в инфракрасном: глазом не видна',sx+sw/2,by+bh/2,'#e8e8ee',10,'center',true); }
    }
    if(!цель) цель=[sx+sw/2,0.8];
    // ---- фотоны
    const пуск=[ax+0.15,(yH+yL)/2];
    const лет=(a,b,w,dy)=>{ const x=a[0]+(b[0]-a[0])*w, y=a[1]+(b[1]-a[1])*w+(dy||0), dir=Math.atan2(b[1]-a[1],b[0]-a[0]);
      КС.пакет(ctx,v,x,y,dir,0.28,0.16,0.32,s.t*14,col,2); };
    if(p.proc==='emit'){ if(u>0.45) лет(пуск,цель,(u-0.45)/0.55); }
    else if(p.proc==='absorb'){ const ист=[sx-0.1,-3.6]; if(u<0.5) лет(ист,пуск,u/0.5);
      v.text(ctx,'фотон ровно с ΔE поглощается,',sx+sw/2,-3.55,ink,10,'center',true); v.text(ctx,'электрон поднимается',sx+sw/2,-3.95,ink,10,'center',true); }
    else { const ист=[lx+lw+0.3,(yH+yL)/2+1.2];
      if(u<0.35) лет(ист,пуск,u/0.35);
      if(u>0.45){ лет(пуск,цель,(u-0.45)/0.55,0.18); лет(пуск,цель,(u-0.45)/0.55,-0.18); }
      v.text(ctx,'налетевший фотон + его копия:',sx+sw/2,-3.55,ink,10,'center',true); v.text(ctx,'та же частота, фаза и направление',sx+sw/2,-3.95,ink,10,'center',true); }
    // ---- формула
    v.text(ctx,`1/λ = R(1/${lo}² − 1/${hi}²) → λ = ${lam.toFixed(1)} нм`,sx+sw/2,-2.2,col==='rgb(255,255,255)'?ink:ink,11,'center',true);
    v.text(ctx,`серия ${this.seriesName(p)}`,sx+sw/2,-2.65,ink3,10);
    if(p.proc==='emit') v.text(ctx,'один переход вниз — один фотон',sx+sw/2,-3.7,ink,10,'center',true);
  }
},

/* ================= ГЛ.27: РЕНТГЕНОВСКАЯ ТРУБКА =================
   Электроны вылетают из накалённого катода, разгоняются напряжением U и
   бьют в анод. Почти вся их энергия уходит в тепло, но иногда рождается
   фотон — двумя путями:
     · тормозное излучение: электрон резко тормозит у ядра и излучает фотон
       любой энергии до eU — отсюда сплошной спектр с резкой границей λмин;
     · характеристическое: электрон выбивает электрон с K-оболочки атома
       анода, дырку занимает электрон с L (линия Kα) или M (Kβ).
   Каждый фотон на картинке прилетает в свой столбик спектра, и спектр
   набирается на глазах. Справа — что в этот момент происходит в атоме. */
xray:{
  title:'Рентгеновское излучение и закон Мозли',
  schema:true,
  timeless:true,
  hudAware:true,
  params:[
    {key:'U',label:'Напряжение на трубке U',unit:'кВ',min:5,max:60,step:1,default:35},
    {key:'Z',label:'Материал анода: Z',min:20,max:80,step:1,default:29},

    {type:'group',label:'Показывать'},
    {key:'lines',label:'Характеристические линии',type:'check',default:true},
    {key:'brems',label:'Тормозное излучение и теоретическая кривая',type:'check',default:true}
  ],
  h:6.62607015e-34, c:2.99792458e8, e:1.602176634e-19, R:1.0973731568e7,
  anodes:{24:'хром',29:'медь',42:'молибден',45:'родий',74:'вольфрам'},
  /* граница тормозного спектра: вся энергия электрона — одному фотону.
     eU = hc/λмин ⇒ λмин = hc/(eU) */
  lamMin(p){ return this.h*this.c/(this.e*p.U*1e3)*1e12; },       // пм
  /* закон Мозли для линии Kα: f = (3/4)·c·R·(Z−1)² */
  fKa(p){ return 0.75*this.c*this.R*Math.pow(p.Z-1,2); },
  lamKa(p){ return this.c/this.fKa(p)*1e12; },                     // пм
  EKa(p){ return this.h*this.fKa(p)/this.e/1e3; },                 // кэВ
  /* линия Kβ: переход с n=3 */
  fKb(p){ return this.c*this.R*(1-1/9)*Math.pow(p.Z-1,2); },
  lamKb(p){ return this.c/this.fKb(p)*1e12; },
  /* видна ли характеристическая линия: нужно, чтобы электрон мог выбить K-электрон */
  linesVisible(p){ return this.EKa(p) < p.U; },
  /* интенсивность тормозного спектра (форма Крамерса) */
  brem(p,lam){
    const lm=this.lamMin(p);
    if(lam<=lm) return 0;
    return (1/(lm))*(1/lam)*(1/lam)*(lam-lm)*8e5;
  },
  /* правый край шкалы: захватить и границу, и линии */
  LMAX(p){ let m=4*this.lamMin(p); if(this.linesVisible(p)) m=Math.max(m,1.2*this.lamKa(p)); return clamp(m,60,420); },
  BINS:90,
  init(p){ return {t:0,seed:18951108,bins:new Array(this.BINS).fill(0),летят:[],фотоны:[],N:0,копилка:0,история:null,__stop:null}; },
  /* один удар электрона об анод: какой фотон родится (λ в пм) */
  удар(s,p){
    const lm=this.lamMin(p), LM=this.LMAX(p);
    if(p.lines && this.linesVisible(p) && КС.rnd(s)<0.12) return КС.rnd(s)<0.83?{l:this.lamKa(p),вид:'Kα'}:{l:this.lamKb(p),вид:'Kβ'};
    if(!p.brems) return null;
    let bm=0; for(let l=lm;l<=LM;l+=LM/200) bm=Math.max(bm,this.brem(p,l));
    for(let k=0;k<60;k++){ const l=lm+КС.rnd(s)*(LM-lm); if(КС.rnd(s)*bm<=this.brem(p,l)) return {l,вид:'торм'}; }
    return {l:lm*1.5,вид:'торм'};
  },
  шкала(p){ const gx=-6.0, gw=11.9; return l=>gx+gw*clamp(l/this.LMAX(p),0,1); },
  step(s,dt,p){
    s.t+=dt;
    // невидимые удары — копят спектр быстрее, чем летят видимые
    s.копилка+=dt*60;
    while(s.копилка>=1){ s.копилка-=1; const f=this.удар(s,p); if(!f) continue;
      const b=Math.floor(f.l/this.LMAX(p)*this.BINS); if(b>=0&&b<this.BINS) s.bins[b]++; s.N++; }
    // видимые электроны: катод → анод
    if(КС.rnd(s)<dt*5) s.летят.push({x:-5.3,y:2.6+(КС.rnd(s)-0.5)*0.3});
    for(const e of s.летят){ e.x+=dt*(1.5+(e.x+5.3)*2.2); if(e.x>=-1.95){ e.done=true;
      const f=this.удар(s,p); if(f){ const X=this.шкала(p)(f.l); s.фотоны.push({x:-1.9,y:e.y,tx:X,ty:-2.8,w:0,f});
        const b=Math.floor(f.l/this.LMAX(p)*this.BINS); if(b>=0&&b<this.BINS) s.bins[b]++; s.N++;
        if(!s.история || s.t-s.история.t0>2.4) s.история={вид:f.вид,t0:s.t}; } } }
    s.летят=s.летят.filter(e=>!e.done);
    for(const f of s.фотоны) f.w+=dt*0.9;
    s.фотоны=s.фотоны.filter(f=>f.w<1);
  },
  anchors(s,p){ return [{x:-1.9,y:2.6}]; },
  readouts(s,p){
    const out=[['напряжение U',p.U,'кВ'],
      ['материал анода Z',p.Z,this.anodes[p.Z]||''],
      ['граница спектра λмин = hc/eU',this.lamMin(p),'пм'],
      ['максимальная энергия фотона',p.U,'кэВ'],
      ['линия Kα: длина волны',this.lamKa(p),'пм'],
      ['линия Kα: энергия',this.EKa(p),'кэВ'],
      ['линия Kβ: длина волны',this.lamKb(p),'пм'],
      ['есть ли характеристические линии',this.linesVisible(p)?1:0,
        this.linesVisible(p)?'да':'нет: напряжения не хватает выбить K-электрон'],
      ['фотонов в спектре',s.N,'']];
    return out;
  },
  graphs:[],
  presets:[
    {name:'Медный анод, 35 кВ',values:{U:35,Z:29}},
    {name:'Выше напряжение — граница левее',values:{U:60,Z:29}},
    {name:'Мало напряжения — линий нет',values:{U:6,Z:29}},
    {name:'Молибденовый анод',values:{U:35,Z:42}},
    {name:'Вольфрам: линии далеко влево',values:{U:60,Z:74}}
  ],
  fit(p,vp){ return КС.fitBox(vp,12.8,10.2,0,0); },
  draw(ctx,s,v,p){
    const acc=v.c('--accent'), meas=v.c('--measure'), dang=v.c('--danger'), sec=v.c('--second'), ink=v.c('--ink-2'), ink3=v.c('--ink-3');
    const X=this.шкала(p), LM=this.LMAX(p), lm=this.lamMin(p);
    // ---- трубка
    КС.рамка(ctx,v,-6.25,0.75,6.1,4.2,'рентгеновская трубка');
    ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1.4); ctx.beginPath(); ctx.ellipse(-3.3,2.55,2.75,1.12,0,0,7); ctx.stroke();
    // катод-спираль
    ctx.strokeStyle='#e0782a'; ctx.lineWidth=v.lw(2); ctx.beginPath();
    for(let i=0;i<=40;i++){ const y=2.1+i/40, x=-5.55+0.12*Math.sin(i*1.4); i?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke();
    v.text(ctx,'катод (−)',-6.05,4.05,ink3,9,'left');
    // анод — скошенный блок
    ctx.fillStyle='#b87333'; ctx.beginPath(); ctx.moveTo(-1.95,1.9); ctx.lineTo(-1.6,1.9); ctx.lineTo(-1.2,3.3); ctx.lineTo(-1.95,3.3); ctx.closePath(); ctx.fill();
    v.text(ctx,`анод (+)`,-0.3,4.05,ink3,9,'right');
    v.text(ctx,`U = ${p.U} кВ`,-3.3,4.05,ink,10,'center',true);
    for(const e of s.летят) КС.точка(ctx,v,e.x,e.y,2.6,sec);
    v.text(ctx,'электроны разгоняются до энергии eU',-3.2,1.02,sec,9);
    // ---- атом анода: что случилось при последнем ударе
    { const cx=3.35, cy=2.65, gx=0.15;
      КС.рамка(ctx,v,gx,0.75,6.1,4.2,'в атоме анода');
      const r=[0.45,0.95,1.45];
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1);
      for(const R of r){ ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke(); }
      КС.точка(ctx,v,cx,cy,6,dang); v.text(ctx,'+',cx,cy,'#fff',9,'center',true);
      v.text(ctx,'K',cx+r[0]+0.08,cy+0.1,ink3,9,'left'); v.text(ctx,'L',cx+r[1]+0.08,cy+0.1,ink3,9,'left'); v.text(ctx,'M',cx+r[2]+0.08,cy+0.1,ink3,9,'left');
      const h=s.история, w=h?clamp((s.t-h.t0)/2.2,0,1):1, вид=h?h.вид:'торм';
      const эл=(R,a,col)=>КС.точка(ctx,v,cx+R*Math.cos(a),cy+R*Math.sin(a),3.2,col||sec);
      const хар=вид!=='торм';
      // K: два электрона, один выбит при характеристическом ударе
      эл(r[0],0.4); if(!(хар&&w>0.25&&w<0.6)) эл(r[0],0.4+Math.PI);
      for(let i=0;i<8;i++) if(!(хар&&i===0&&w>=0.6)) эл(r[1],i*Math.PI/4+0.2);
      for(let i=0;i<6;i++) эл(r[2],i*Math.PI/3);
      if(хар){
        // налетающий электрон, выбитый K-электрон, переход L→K (или M→K) и фотон
        if(w<0.25){ const q=w/0.25; КС.точка(ctx,v,gx+0.3+(cx-r[0]-gx-0.3)*q,cy-0.9*(1-q)+Math.sin(0.4+Math.PI)*r[0]*q,3,meas); }
        else if(w<0.6){ const q=(w-0.25)/0.35; КС.точка(ctx,v,cx-r[0]-q*2.2,cy-r[0]*0.4-q*1.5,3,meas);
          ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.2); ctx.beginPath(); ctx.arc(cx+r[0]*Math.cos(0.4+Math.PI),cy+r[0]*Math.sin(0.4+Math.PI),v.lw(5),0,7); ctx.stroke();
          v.text(ctx,'дырка в K',cx-1.2,cy-1.75,dang,9); }
        else { const q=(w-0.6)/0.4, R0=вид==='Kα'?r[1]:r[2], a=0.2+q*(0.4+Math.PI-0.2), R=R0+(r[0]-R0)*Math.min(1,q*2);
          if(q<0.5) эл(R,a,sec);
          const d=0.4+q*1.4; КС.пакет(ctx,v,cx+0.4+d*0.7,cy+0.3+d*0.55,0.66,0.22,0.16,0.3,s.t*14,meas,2);
          v.text(ctx,`${вид==='Kα'?'L → K: линия Kα':'M → K: линия Kβ'}`,cx,0.95+0.25,meas,10,'center',true); }
        if(w<0.6) v.text(ctx,'электрон выбивает электрон с K-оболочки',cx,0.95+0.25,ink,9,'center',true);
      } else {
        // тормозное: электрон проносится мимо ядра, изгибается и излучает
        const q=w, x=gx+0.3+q*5.5, y=cy-1.1+0.9*Math.exp(-Math.pow((x-cx)/0.9,2))-Math.max(0,x-cx)*0.2;
        КС.точка(ctx,v,x,y,3,meas);
        if(q>0.5){ const d=(q-0.5)*3; КС.пакет(ctx,v,cx+0.3+d*0.6,cy-0.2+d*0.8,0.93,0.3,0.15,0.3,s.t*14,sec,2); }
        v.text(ctx,'электрон тормозит у ядра → фотон',cx,0.95+0.25,ink,9,'center',true);
      }
    }
    // ---- фотоны летят в спектр
    for(const f of s.фотоны){ const x=-1.7+(f.tx+1.7)*f.w, y=f.y-0.4+(f.ty-f.y+0.4)*f.w;
      КС.точка(ctx,v,x,y,2.6,f.f.вид==='торм'?sec:meas); }
    // ---- спектр
    { const gy=-4.95, gh=5.45, yb=gy+0.7, H=gh-1.55, bw=(X(LM)-X(0))/this.BINS;
      const есть=p.lines&&this.linesVisible(p), пик=l=>есть&&(Math.abs(l-this.lamKa(p))<LM/this.BINS||Math.abs(l-this.lamKb(p))<LM/this.BINS);
      let mx=8; for(let b=0;b<this.BINS;b++) if(!пик((b+0.5)*LM/this.BINS)) mx=Math.max(mx,s.bins[b]*1.3);
      КС.рамка(ctx,v,-6.25,gy,12.5,gh,`спектр: собрано ${s.N} фотонов`);
      ctx.strokeStyle=ink3; ctx.lineWidth=v.lw(1); ctx.beginPath(); ctx.moveTo(X(0),yb); ctx.lineTo(X(LM),yb); ctx.stroke();
      const шаг=LM>250?100:(LM>120?40:20);
      for(let l=0;l<=LM;l+=шаг){ ctx.beginPath(); ctx.moveTo(X(l),yb); ctx.lineTo(X(l),yb-0.08); ctx.stroke(); v.text(ctx,`${l}`,X(l),yb-0.25,ink3,9); }
      v.text(ctx,'λ, пм',X(LM),yb+0.22,ink3,9,'right');
      for(let b=0;b<this.BINS;b++) if(s.bins[b]){ const l=(b+0.5)*LM/this.BINS;
        const хар=пик(l);
        ctx.fillStyle=хар?meas:sec; ctx.globalAlpha=.7; ctx.fillRect(X(0)+b*bw,yb,bw*0.92,H*Math.min(1,s.bins[b]/mx)); }
      ctx.globalAlpha=1;
      // теоретическая кривая тормозного спектра под ту же высоту
      if(p.brems && s.N>30){ let сум=0; for(let b=0;b<this.BINS;b++) if(!пик((b+0.5)*LM/this.BINS)) сум+=s.bins[b];
        let norm=0; for(let b=0;b<this.BINS;b++) norm+=this.brem(p,(b+0.5)*LM/this.BINS);
        if(norm>0){ ctx.strokeStyle=ink; ctx.lineWidth=v.lw(1.6); ctx.beginPath(); let first=true;
          for(let i=0;i<=240;i++){ const l=lm+(LM-lm)*i/240, y=yb+H*Math.min(1.05,сум*this.brem(p,l)/norm/mx);
            first?(ctx.moveTo(X(l),y),first=false):ctx.lineTo(X(l),y); }
          ctx.stroke(); } }
      // граница λмин
      ctx.save(); ctx.setLineDash([v.lw(4),v.lw(3)]); ctx.strokeStyle=dang; ctx.lineWidth=v.lw(1.5);
      ctx.beginPath(); ctx.moveTo(X(lm),yb); ctx.lineTo(X(lm),yb+H+0.15); ctx.stroke(); ctx.restore();
      v.text(ctx,`λмин = hc/eU = ${lm.toFixed(1)} пм`,X(lm)+0.1,yb+H+0.1,dang,10,'left',true);
      v.text(ctx,'левее — ни одного фотона',X(lm)+0.1,yb+H-0.3,ink3,9,'left');
      if(p.lines && this.linesVisible(p)){
        if(this.lamKa(p)<LM) v.text(ctx,`Kα ${this.lamKa(p).toFixed(1)}`,X(this.lamKa(p))+0.12,yb+H*0.9,meas,10,'left',true);
        if(this.lamKb(p)<LM) v.text(ctx,`Kβ ${this.lamKb(p).toFixed(1)}`,X(this.lamKb(p))-0.12,yb+H*0.62,meas,10,'right',true);
        v.text(ctx,'пики Kα и Kβ — «подпись» элемента: f ∝ (Z − 1)² (закон Мозли)',0,gy+0.22,meas,10,'center');
      } else if(p.lines) v.text(ctx,`пиков нет: eU = ${p.U} кэВ мало, чтобы выбить K-электрон`,0,gy+0.22,dang,10,'center');
    }
  }
},

});
