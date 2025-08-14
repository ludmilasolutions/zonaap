/* Zonaap / Multi-tenant El Tachi core */
(() => {
  const slug = (window.ZONAAP_SLUG || 'demo-tachi').toLowerCase();
  document.title = `Tienda | ${slug} — Zonaap`;

  // Helpers de asset y base
  const asset = p => (location.hostname.endsWith('github.io')
    ? `/${location.pathname.split('/').filter(Boolean)[0]}/${p}`
    : `/${p}`);

  const BASE = `locales/${slug}/`;

  // ===== Temas por local (CSS variables) =====
  function applyTheme(vars){
    if(!vars || typeof vars!=='object') return;
    const r = document.documentElement;
    Object.entries(vars).forEach(([k,v])=>{
      if(typeof v === 'string' && v.trim()){
        r.style.setProperty(`--${k}`, v.trim());
      }
    });
  }

  // ===== Loader de content.json (si existe) =====
  async function tryLoadContentJson() {
    try {
      const r = await fetch(asset(`${BASE}content.json`));
      if(!r.ok) return null;
      const content = await r.json();
      return content;
    } catch { return null; }
  }

  const logoImg = document.getElementById('negLogo');
  const titleEl = document.getElementById('negTitle');
  const subEl   = document.getElementById('negSub');

  // ===== Variables (defaults) =====
  let HORARIOS = {
    rotiseria: { dias:[4,5,6,0], rangos:[{desde:'19:30', hasta:'22:30'}] },
    bebidas:   { dias:[0,1,2,3,4,5,6], rangos:[{desde:'09:00', hasta:'23:59'}] }
  };
  let SECCIONES_CERRADAS = { rotiseria:false, bebidas:false };
  let CIERRE_MSGS = { rotiseria:'', bebidas:'' };
  let SHIPPING = 1000;
  const CUPONES_DEFAULT = [
    {code:'ZONA10', type:'percent', value:10},
    {code:'ENVIOGRATIS', type:'shipping', value:100},
    {code:'ZONA500', type:'fixed', value:500}
  ];
  let CUPONES = [...CUPONES_DEFAULT];
  const ITEM_NOTES = {}; // id -> nota
  let WSP_NUMBER = '3415923882';
  let NEG_NAME = 'Tienda';
  let NEG_LOGO = asset('assets/zonaap-wordmark-invert.svg');

  // ===== Analytics: Apps Script, agrega slug =====
  const ANALYTICS_KEY='tachi_events_v1';
  const ANALYTICS_WEBHOOK=''; // opcional: setear en ajustes.json (analytics_webhook)
  function getEvents(){try{return JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'[]')}catch{return[]}}
  function saveEvents(l){localStorage.setItem(ANALYTICS_KEY,JSON.stringify(l))}
  function logEvent(type,data={}){
    const e={type,ts:new Date().toISOString(),path:location.pathname+location.search,slug,...data};
    const l=getEvents();l.push(e);saveEvents(l); scheduleFlush();
  }
  let FLUSH_TIMER=null;
  function scheduleFlush(delay=1500){ clearTimeout(FLUSH_TIMER); FLUSH_TIMER=setTimeout(()=>flushEvents('timer'), delay); }
  function flushEvents(reason='auto'){
    try{
      const events=getEvents();
      if(!events.length) return;
      const payload={ kind:'batch', reason, url:location.href, ref:document.referrer||'', tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'', ua:navigator.userAgent, events };
      const hook = window.ANALYTICS_WEBHOOK || ANALYTICS_WEBHOOK;
      if(!hook){ saveEvents([]); return; }
      let sent=false;
      if(navigator.sendBeacon){
        const blob=new Blob([JSON.stringify(payload)],{type:'text/plain'});
        sent=navigator.sendBeacon(hook, blob);
      }
      if(!sent){
        fetch(hook,{method:'POST',mode:'no-cors',keepalive:true,body:JSON.stringify(payload)}).catch(()=>{});
      }
      saveEvents([]);
    }catch{}
  }
  window.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden'){ flushEvents('hidden'); }});
  window.addEventListener('beforeunload',()=>{ flushEvents('unload'); });
  window.addEventListener('online',()=>scheduleFlush(250));
  setInterval(()=>flushEvents('interval'), 20000);

  // ===== TTL storage =====
  function setWithTTL(key, value, ttlMs){const payload={ v:value, exp:Date.now()+ttlMs }; localStorage.setItem(key, JSON.stringify(payload));}
  function getWithTTL(key, fallback){
    try{
      const raw=JSON.parse(localStorage.getItem(key));
      if(!raw || typeof raw!=='object') return fallback;
      if(raw.exp && Date.now()>raw.exp){ localStorage.removeItem(key); return fallback; }
      return (raw.v===undefined?fallback:raw.v);
    }catch{ return fallback; }
  }
  const CART_TTL_MS=2*60*60*1000;
  const CLIENT_TTL_MS=2*60*60*1000;
  const CART_KEY=`${slug}_cart_v1`;
  const CLIENT_KEY=`${slug}_client_v1`;
  const loadCart   = () => getWithTTL(CART_KEY, {});
  const saveCart   = (obj) => setWithTTL(CART_KEY, obj,   CART_TTL_MS);
  const loadClient = () => getWithTTL(CLIENT_KEY, {});
  const saveClient = (obj) => setWithTTL(CLIENT_KEY, obj, CLIENT_TTL_MS);

  // ===== UI helpers (muy resumido) =====
  const formatARS=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
  const cantidades = {};

  function normalizar(d){ return Array.isArray(d?.categorias)?Object.fromEntries(d.categorias.map(c=>[c.categoria,c.productos||[]])):d||{}; }

  function renderProductos(contId,data){
    const cont=document.getElementById(contId); if(!cont) return; cont.innerHTML='';
    const norm=normalizar(data);
    for(const cat in norm){
      const items=norm[cat]||[];const det=document.createElement('details');
      const sum=document.createElement('summary');sum.textContent=cat;det.appendChild(sum);
      items.forEach((prod,i)=>{
        const id=`${contId}-${cat}-${i}`;if(!(id in cantidades))cantidades[id]=0;
        const isPromo = !!prod._promo;
        const priceHTML = isPromo
          ? `<div class="price-wrap">
               ${prod._promo.precio_original ? `<span class="price-old">${formatARS(prod._promo.precio_original)}</span>` : ''}
               <span class="price-new">${formatARS(prod.precio)}</span>
             </div>`
          : `<div class="price-wrap"><span class="price-new">${formatARS(prod.precio)}</span></div>`;

        const div=document.createElement('div');div.className='producto';
        const thumb = prod.img ? asset(prod.img) : asset('assets/zonaap-pro-wordmark.svg');
        div.innerHTML=`
          <div class="prod-thumb"><img src="${thumb}" alt="${prod.nombre}"></div>
          <div class="producto-info">
            <h3 style="margin:0;color:#004c99;font-size:1rem">
              ${prod.nombre}
              ${isPromo && prod._promo.tag ? `<span class="promo-badge">${prod._promo.tag}</span>` : ''}
            </h3>
            ${prod.desc?`<p>${prod.desc}</p>`:''}
            ${priceHTML}
          </div>
          <div class="contador">
            <button onclick="cambiarCantidad('${id}',-1,this)">−</button>
            <span id="cantidad-${id}">0</span>
            <button onclick="cambiarCantidad('${id}',1,this)">+</button>
          </div>`;
        div.dataset.nombre=prod.nombre;div.dataset.precio=prod.precio;det.appendChild(div);
      });
      cont.appendChild(det);
    }
  }

  function mergePromos(baseData, promosData){
    const out = baseData && Array.isArray(baseData.categorias) ? { categorias:[...baseData.categorias] } : { categorias:[] };
    const promos = (promosData && Array.isArray(promosData.promos)) ? promosData.promos : [];
    const hoy = new Date().toISOString().slice(0,10);
    const vigentes = promos.filter(p => !p.vigencia_hasta || p.vigencia_hasta >= hoy);
    if(vigentes.length){
      out.categorias = [
        {
          categoria: '⭐ Promos',
          productos: vigentes.map(p => ({
            nombre: p.nombre,
            precio: p.precio,
            desc: p.desc || '',
            _promo: { precio_original: p.precio_original || null, tag: p.tag || null }
          }))
        },
        ...out.categorias
      ];
    }
    return out;
  }

  // ===== Horarios =====
  function hmToMin(hm){const [h,m]=hm.split(':').map(Number);return h*60+(m||0)}
  function ahoraMin(){const n=new Date();return n.getHours()*60+n.getMinutes()}
  function hoyDia(){return new Date().getDay()}
  function estaAbierto(seccion){
    if(SECCIONES_CERRADAS[seccion]) return false;
    const cfg = HORARIOS[seccion]; if(!cfg) return true;
    if(!cfg.dias.includes(hoyDia())) return false;
    const now = ahoraMin();
    return cfg.rangos.some(r => now >= hmToMin(r.desde) && now <= hmToMin(r.hasta));
  }
  function proximoHorario(seccion){
    const cfg = HORARIOS[seccion]; if(!cfg) return null;
    const diasTxt=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const d = hoyDia(), now=ahoraMin();
    if(cfg.dias.includes(d)){
      for(const r of cfg.rangos){
        if(now <= hmToMin(r.hasta)){
          return now <= hmToMin(r.desde) ? `Hoy ${r.desde}–${r.hasta}` : `Hoy hasta ${r.hasta}`;
        }
      }
    }
    for(let i=1;i<=7;i++){
      const nd=(d+i)%7;
      if(cfg.dias.includes(nd)){
        const r=cfg.rangos[0];
        return `${diasTxt[nd]} ${r.desde}–${r.hasta}`;
      }
    }
    return null;
  }
  function seccionDeId(id){
    if(id.startsWith('menu-rotiseria-')) return 'rotiseria';
    if(id.startsWith('menu-bebidas-'))   return 'bebidas';
    return id.includes('bebidas') ? 'bebidas' : 'rotiseria';
  }
  function seccionCerradaAhora(sec){ return !estaAbierto(sec); }
  function mensajeCierre(sec){
    if(SECCIONES_CERRADAS[sec] && CIERRE_MSGS[sec]?.trim()){
      return CIERRE_MSGS[sec].trim();
    }
    const prox = proximoHorario(sec);
    return prox ? `Próximo horario: ${prox}.` : 'Cerrado por ahora.';
  }

  // ===== Carrito y totales (resumen mínimo) =====
  window.cambiarCantidad = function(id,delta,btn){
    const sec = seccionDeId(id);
    if(delta > 0 && seccionCerradaAhora(sec)){
      alert(`${sec} está cerrado. ${mensajeCierre(sec)}`);
      return;
    }
    cantidades[id]=Math.max(0,(cantidades[id]||0)+delta);
    const span=document.getElementById(`cantidad-${id}`);if(span)span.textContent=cantidades[id];
    try{
      const row=document.getElementById(`cantidad-${id}`)?.closest?.('.producto');
      const name=row?.dataset?.nombre||''; const price=parseInt(row?.dataset?.precio||0,10);
      logEvent('qty_change',{id,delta,new_qty:cantidades[id],sec,name,price});
    }catch{}
    saveCart(cantidades);
    actualizarResumen();
  }

  function countItems(){ return Object.values(cantidades).reduce((a,b)=>a+(b||0),0); }

  function actualizarResumen(){
    const cup = typeof CUPON_APLICADO==='object'?CUPON_APLICADO:null;
    // (en esta versión starter, solo calculamos totales para el FAB simple)
    let subtotal=0,count=0;
    for(const id in cantidades){
      const qty=cantidades[id]; if(qty<=0) continue;
      const span=document.getElementById(`cantidad-${id}`); if(!span) continue;
      const row=span.closest('.producto'); const price=parseInt(row?.dataset?.precio||0,10);
      subtotal += price*qty; count += qty;
    }
    window.METRICS_TOTAL=subtotal; window.METRICS_COUNT=count;
  }

  // ===== Tabs =====
  window.mostrar = function(sec){
    const r1=document.getElementById('menu-rotiseria'), r2=document.getElementById('menu-bebidas');
    if(seccionCerradaAhora(sec)){
      const cont = document.getElementById(`menu-${sec}`);
      if(cont){
        cont.style.display = 'block';
        const nombreSec = sec[0].toUpperCase()+sec.slice(1);
        cont.innerHTML = `<div class="seccion-closed-overlay" style="padding:1rem;border:1px dashed #f59e0b;border-radius:10px;margin:.5rem 0 1rem;background:#fff8e1;color:#7a4c00;font-weight:600;text-align:center">
          🚧 ${nombreSec} está cerrada por ahora.<br>${mensajeCierre(sec)}</div>`;
      }
      const otra = sec==='bebidas' ? 'rotiseria' : 'bebidas';
      const contOtra=document.getElementById(`menu-${otra}`); if(contOtra) contOtra.style.display='none';
      const btnSec=document.getElementById(`btn-${sec}`), btnOtra=document.getElementById(`btn-${otra}`);
      btnSec?.classList?.add('active'); btnOtra?.classList?.remove('active');
      return;
    }
    if(r1) r1.style.display = (sec==='rotiseria')?'block':'none';
    if(r2) r2.style.display = (sec==='bebidas')?'block':'none';
    document.getElementById('btn-rotiseria')?.classList?.toggle('active', sec==='rotiseria');
    document.getElementById('btn-bebidas')?.classList?.toggle('active', sec==='bebidas');
  };

  // ===== Carga de ajustes + productos (per tenant) =====
  async function cargarAjustes(){
    try{
      const r = await fetch(asset(`${BASE}ajustes.json`));
      if(!r.ok) throw new Error('HTTP '+r.status);
      const aj = await r.json();
      if(aj.nombre){ NEG_NAME = aj.nombre; titleEl.textContent = aj.nombre; document.title = `${aj.nombre} | Zonaap`; }
      if(aj.logo){ NEG_LOGO = aj.logo; if(logoImg) logoImg.src = aj.logo; }
      if(aj.sub){ subEl && (subEl.textContent = aj.sub); }
      if(aj.whatsapp) WSP_NUMBER = String(aj.whatsapp).replace(/\D/g,'') || WSP_NUMBER;
      if(typeof aj.shipping === 'number') SHIPPING = aj.shipping;
      if(aj.analytics_webhook){ window.ANALYTICS_WEBHOOK = aj.analytics_webhook; }
      // Etiquetas de pestañas (opcional)
      const br = document.getElementById('btn-rotiseria');
      const bb = document.getElementById('btn-bebidas');
      if(aj.tab_rotiseria && br) br.textContent = aj.tab_rotiseria;
      if(aj.tab_bebidas && bb) bb.textContent = aj.tab_bebidas;
      if(Array.isArray(aj.cupones)) CUPONES = aj.cupones;
      const h = aj.horarios || {};
      ['rotiseria','bebidas'].forEach(sec=>{
        const cfg = h[sec] || {};
        if(!HORARIOS[sec]) HORARIOS[sec]={dias:[],rangos:[]};
        if(Array.isArray(cfg.dias)) HORARIOS[sec].dias = cfg.dias.map(Number);
        if(Array.isArray(cfg.rangos)) HORARIOS[sec].rangos = cfg.rangos.map(r=>({desde:r.desde, hasta:r.hasta}));
        if(typeof cfg.cerrado === 'boolean') SECCIONES_CERRADAS[sec] = cfg.cerrado;
        CIERRE_MSGS[sec] = (cfg.mensaje_cierre || '').toString();
      });
    }catch(e){ console.warn('Ajustes default', e); }
  }

  async function cargarProductos(){
    const content = await tryLoadContentJson();
    if(content && content.ajustes){
      // Ajustes desde content.json
      const aj = content.ajustes || {};
      if(aj.nombre){ NEG_NAME = aj.nombre; titleEl.textContent = aj.nombre; document.title = `${aj.nombre} | Zonaap`; }
      if(aj.logo){ NEG_LOGO = aj.logo; if(logoImg) logoImg.src = aj.logo; }
      if(aj.sub){ subEl && (subEl.textContent = aj.sub); }
      if(aj.whatsapp) WSP_NUMBER = String(aj.whatsapp).replace(/\D/g,'') || WSP_NUMBER;
      if(typeof aj.shipping === 'number') SHIPPING = aj.shipping;
      if(aj.analytics_webhook){ window.ANALYTICS_WEBHOOK = aj.analytics_webhook; }
      // Etiquetas de pestañas (opcional)
      const br = document.getElementById('btn-rotiseria');
      const bb = document.getElementById('btn-bebidas');
      if(aj.tab_rotiseria && br) br.textContent = aj.tab_rotiseria;
      if(aj.tab_bebidas && bb) bb.textContent = aj.tab_bebidas;
      if(Array.isArray(aj.cupones)) CUPONES = aj.cupones;
      const h = aj.horarios || {};
      ['rotiseria','bebidas'].forEach(sec=>{
        const cfg = h[sec] || {};
        if(!HORARIOS[sec]) HORARIOS[sec]={dias:[],rangos:[]};
        if(Array.isArray(cfg.dias)) HORARIOS[sec].dias = cfg.dias.map(Number);
        if(Array.isArray(cfg.rangos)) HORARIOS[sec].rangos = cfg.rangos.map(r=>({desde:r.desde, hasta:r.hasta}));
        if(typeof cfg.cerrado === 'boolean') SECCIONES_CERRADAS[sec] = cfg.cerrado;
        CIERRE_MSGS[sec] = (cfg.mensaje_cierre || '').toString();
      });
      // Tema
      if(aj.theme) applyTheme(aj.theme);

      // Productos + Promos desde content.json
      const rOk = (content.productos && content.productos.rotiseria) || { categorias:[] };
      const bOk = (content.productos && content.productos.bebidas)   || { categorias:[] };
      const prOk = (content.promos && content.promos.rotiseria) || { promos:[] };
      const pbOk = (content.promos && content.promos.bebidas)   || { promos:[] };
      const rMerge = mergePromos(rOk, prOk);
      const bMerge = mergePromos(bOk, pbOk);
      renderProductos('menu-rotiseria', rMerge);
      renderProductos('menu-bebidas',  bMerge);
      logEvent('menus_loaded',{slug,rotiseria_cats:(rMerge.categorias||[]).length,bebidas_cats:(bMerge.categorias||[]).length, mode:'content.json'});
      return;
    }

    // Fallback a archivos separados
    await cargarAjustes();
    const rotiseria = fetch(asset(`${BASE}productos-rotiseria.json`)).then(r=>r.json()).catch(()=>({categorias:[]}));
    const bebidas   = fetch(asset(`${BASE}productos-bebidas.json`)).then(r=>r.json()).catch(()=>({categorias:[]}));
    const promosR   = fetch(asset(`${BASE}promos-rotiseria.json`)).then(r=>r.json()).catch(()=>({}));
    const promosB   = fetch(asset(`${BASE}promos-bebidas.json`)).then(r=>r.json()).catch(()=>({}));
    const [rOk,bOk,prOk,pbOk] = await Promise.all([rotiseria, bebidas, promosR, promosB]);
    const rMerge = mergePromos(rOk, prOk);
    const bMerge = mergePromos(bOk, pbOk);
    renderProductos('menu-rotiseria', rMerge);
    renderProductos('menu-bebidas',  bMerge);
    logEvent('menus_loaded',{slug,rotiseria_cats:(rMerge.categorias||[]).length,bebidas_cats:(bMerge.categorias||[]).length, mode:'split-files'});
  }
  window.addEventListener('DOMContentLoaded', ()=>{
    cargarProductos().then(()=>{
      // Arranca mostrando la primera tab
      mostrar('rotiseria');
      logEvent('page_view',{title:document.title});
    });
  });
})();