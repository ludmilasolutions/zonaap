
(function(){
  const $ = s=>document.querySelector(s);
  const fmt = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
  const params = new URLSearchParams(location.search);
  const slug = params.get('l') || '';

  const state = {
    items: {}, // id -> qty
    catalog: {}, // id -> {nombre, precio}
    ajustes: { whatsapp:'', envio_costo: 0, cupones:[] }
  };

  const TTL_MS = 2*60*60*1000;
  function setWithTTL(k,v,ttl){ localStorage.setItem(k, JSON.stringify({v, exp: Date.now()+ttl})); }
  function getWithTTL(k, fallback){ try{ const raw = JSON.parse(localStorage.getItem(k)); if(!raw) return fallback; if(raw.exp && Date.now()>raw.exp){ localStorage.removeItem(k); return fallback; } return raw.v ?? fallback; }catch{return fallback} }

  const CART_KEY = 'za_cart_'+slug;
  const CLIENT_KEY = 'za_client';

  function saveCart(){ setWithTTL(CART_KEY, state.items, TTL_MS); }
  function loadCart(){ state.items = getWithTTL(CART_KEY, {}); }
  function saveClient(){ const c={name:$('#nombre')?.value||'', addr:$('#direccion')?.value||'', entrega:document.querySelector('input[name=envio]:checked')?.value||''}; setWithTTL(CLIENT_KEY,c,TTL_MS); }
  function loadClient(){ const c = getWithTTL(CLIENT_KEY, {}); if(c.name) $('#nombre').value=c.name; if(c.addr) $('#direccion').value=c.addr; if(c.entrega){ document.getElementById('opt-'+(c.entrega==='envio'?'env':'ret')).checked=true; } }

  async function loadData(){
    const res = await fetch('locales/'+slug+'/content.json'); const data = await res.json();
    // Header
    $('#title').textContent = data.nombre || 'Local';
    $('#sub').textContent = data.sub || '';
    $('#logo').src = data.logo || 'assets/za-icon.svg';

    state.ajustes.whatsapp = (data.ajustes?.whatsapp||'').replace(/\D/g,'');
    state.ajustes.envio_costo = Number(data.ajustes?.envio_costo||0);
    state.ajustes.cupones = Array.isArray(data.ajustes?.cupones)?data.ajustes.cupones:[];
    $('#envioLabel').textContent = 'Envío (+'+fmt(state.ajustes.envio_costo)+')';

    // Categories collected from all sections (no section tabs)
    const chips = $('#chips'); chips.innerHTML='';
    const content = $('#content'); content.innerHTML='';

    const sections = Array.isArray(data.secciones)?data.secciones:[];
    let anchorIndex = 0;
    sections.forEach(sec => {
      const categorias = Array.isArray(sec.categorias)?sec.categorias:[];
      categorias.forEach(cat => {
        anchorIndex++;
        const anchor = 'cat-'+anchorIndex;
        // chip
        const a = document.createElement('a');
        a.href = '#'+anchor; a.textContent = `${cat.nombre} (${(cat.productos||[]).length})`;
        chips.appendChild(a);
        // section block
        const box = document.createElement('div'); box.className='section'; box.id = anchor;
        box.innerHTML = `<h2>${cat.nombre}</h2>`;
        (cat.productos||[]).forEach((p,i)=>{
          // id
          const id = `${anchor}-${i}`;
          state.catalog[id] = {nombre:p.nombre, precio:Number(p.precio||0)};
          const row = document.createElement('div'); row.className='prod';
          const img = p.img || 'assets/za-icon.svg';
          row.innerHTML = `
            <div class="thumb"><img src="${img}" alt="${p.nombre}"></div>
            <div>
              <h3>${p.nombre}</h3>
              ${p.desc?`<p>${p.desc}</p>`:''}
              <div class="price">${fmt(p.precio)}</div>
            </div>
            <div class="qty">
              <button aria-label="Quitar" data-id="${id}" data-d="-1">−</button>
              <span id="q-${id}">${state.items[id]||0}</span>
              <button aria-label="Agregar" data-id="${id}" data-d="1">+</button>
            </div>`;
          content.appendChild(box); box.appendChild(row);
        });
      });
    });
    // qty handlers
    content.addEventListener('click', ev=>{
      const b = ev.target.closest('button[data-id]'); if(!b) return;
      const id = b.getAttribute('data-id'); const d = Number(b.getAttribute('data-d'));
      const q = Math.max(0, (state.items[id]||0)+d); state.items[id]=q; saveCart();
      $('#q-'+id).textContent=q; refresh();
    });
  }

  function refresh(){
    // FAB
    const count = Object.values(state.items).reduce((a,b)=>a+(b||0),0);
    const subtotal = Object.entries(state.items).reduce((s,[id,q])=> s + (state.catalog[id]?.precio||0)*q, 0);
    $('#fabCount').textContent = count; $('#fabTotal').textContent = fmt(subtotal);
    $('#fab').classList.toggle('hidden', count<=0);

    // Sheet summary
    const ul = $('#items'); ul.innerHTML='';
    Object.entries(state.items).forEach(([id,q])=>{
      if(q<=0) return;
      const p = state.catalog[id]; if(!p) return;
      const li = document.createElement('li');
      li.className='line'; li.innerHTML = `<span>${p.nombre} <span class="small">x${q}</span></span><strong>${fmt(p.precio*q)}</strong>`;
      ul.appendChild(li);
    });

    // envio
    const entrega = document.querySelector('input[name=envio]:checked')?.value||'';
    const envio = entrega==='envio' ? state.ajustes.envio_costo : 0;
    $('#env').textContent = fmt(envio);
    $('#envioLine').textContent = entrega==='envio' ? 'Envío' : 'Entrega';
    // descuento por cupón
    const code = ($('#cupon')?.value||'').trim().toUpperCase();
    let desc = 0;
    const c = state.ajustes.cupones.find(x => x.code?.toUpperCase()===code);
    if(c){
      if(c.type==='percent') desc = Math.round(subtotal * (Number(c.value||0)/100));
      if(c.type==='amount') desc = Number(c.value||0);
      if(c.type==='shipping_free') desc = envio;
    }
    const propPct = parseFloat(($('#propina')?.value||'').replace(',','.'))||0;
    const tip = Math.round(subtotal * Math.max(0, Math.min(propPct, 99))/100);
    $('#subtot').textContent = fmt(subtotal);
    $('#desc').textContent = '- '+fmt(desc);
    $('#tip').textContent = fmt(tip);
    const total = Math.max(0, subtotal - desc) + envio + tip;
    $('#total').textContent = fmt(total);

    // steps active
    const datosOk = ($('#nombre')?.value.trim().length>0) && (!!entrega) && (entrega==='retiro' || $('#direccion')?.value.trim().length>0);
    document.querySelectorAll('.step').forEach(s=>{
      const n = Number(s.getAttribute('data-step'));
      s.classList.toggle('active', (n===1 && !datosOk) || (n===2 && datosOk && count>0) || (n===3 && datosOk && count>0));
    });
  }

  function openSheet(){ $('#backdrop').classList.add('open'); $('#sheet').classList.add('open'); refresh(); }
  function closeSheet(){ $('#backdrop').classList.remove('open'); $('#sheet').classList.remove('open'); }

  // Events
  document.addEventListener('click', e=>{
    if(e.target.id==='fab'){ openSheet(); }
    if(e.target.id==='close' || e.target.id==='backdrop'){ closeSheet(); }
    if(e.target.id==='btnClear'){ state.items={}; saveCart(); document.querySelectorAll('[id^="q-"]').forEach(el=>el.textContent='0'); refresh(); }
    if(e.target.id==='btnWA'){ sendWA(); }
  });
  ['nombre','direccion','cupon','propina','nota'].forEach(id=>{
    document.addEventListener('input', e=>{ if(e.target.id===id){ if(id==='nombre'||id==='direccion') saveClient(); refresh(); } });
  });
  document.addEventListener('change', e=>{
    if(e.target.name==='envio'){ const entrega = e.target.value; saveClient();
      document.getElementById('addrWrap').classList.toggle('hidden', entrega!=='envio'); refresh(); }
  });

  function sendWA(){
    const entrega = document.querySelector('input[name=envio]:checked')?.value||'';
    const name = $('#nombre')?.value.trim()||'';
    const addr = $('#direccion')?.value.trim()||'';
    const count = Object.values(state.items).reduce((a,b)=>a+(b||0),0);
    if(!entrega){ alert('Elegí Retiro o Envío'); return; }
    if(!name){ alert('Ingresá tu nombre'); return; }
    if(count<=0){ alert('Agregá al menos un producto'); return; }
    if(entrega==='envio' && !addr){ alert('Ingresá tu dirección'); return; }

    const subtotal = Object.entries(state.items).reduce((s,[id,q])=> s + (state.catalog[id]?.precio||0)*q, 0);
    const envio = entrega==='envio' ? state.ajustes.envio_costo : 0;
    const code = ($('#cupon')?.value||'').trim().toUpperCase();
    let desc = 0; const c = state.ajustes.cupones.find(x => x.code?.toUpperCase()===code);
    if(c){ if(c.type==='percent') desc = Math.round(subtotal * (Number(c.value||0)/100));
      if(c.type==='amount') desc = Number(c.value||0); if(c.type==='shipping_free') desc = envio; }
    const propPct = parseFloat(($('#propina')?.value||'').replace(',','.'))||0;
    const tip = Math.round(subtotal * Math.max(0, Math.min(propPct, 99))/100);
    const total = Math.max(0, subtotal - desc) + envio + tip;

    let msg = `Hola, soy ${name}. Quiero hacer un pedido:\\n`;
    Object.entries(state.items).forEach(([id,q])=>{
      if(q>0){ const p = state.catalog[id]; msg+=`- ${p.nombre} x${q} - ${fmt(p.precio*q)}\\n`; }
    });
    if($('#nota')?.value.trim()) msg+=`Nota: ${$('#nota').value.trim()}\\n`;
    if(code) msg+=`Cupón: ${code}\\n`;
    msg+= entrega==='envio' ? `Envío a: ${addr} (+${fmt(state.ajustes.envio_costo)})\\n` : 'Retiro en el local\\n';
    msg+= `Subtotal: ${fmt(subtotal)}\\n`;
    if(desc) msg+= `Descuento: -${fmt(desc)}\\n`;
    if(tip) msg+= `Propina: ${fmt(tip)}\\n`;
    msg+= `Total: ${fmt(total)}`;

    const wsp = state.ajustes.whatsapp || '';
    const url = `https://wa.me/${wsp}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');

    // reset cart
    state.items={}; saveCart(); closeSheet(); refresh();
  }

  // Init
  (async function(){
    if(!slug){ document.body.innerHTML = '<div class="wrap" style="padding:40px">Falta el parámetro ?l=</div>'; return; }
    loadCart(); await loadData(); loadClient(); refresh();

    // defaults for entrega
    const entrega = document.querySelector('input[name=envio]:checked')?.value || '';
    if(!entrega){ document.getElementById('opt-ret').checked = true; }
    document.getElementById('addrWrap').classList.toggle('hidden', document.getElementById('opt-env').checked!==true);
  })();
})();
