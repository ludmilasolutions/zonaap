// Helpers
const $ = sel => document.querySelector(sel);
const fmt = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
const slug = new URLSearchParams(location.search).get('l') || '';

let SHOP = null;
let CART = {}; // {key: qty}

async function loadShop(){
  const resIdx = await fetch('locales/index.json');
  const idx = await resIdx.json();
  const meta = (idx.locales||[]).find(x => x.slug===slug) || idx.locales?.[0];
  const res = await fetch(`locales/${meta.slug}/content.json`);
  const data = await res.json();
  return {...meta, ...data};
}

function buildProductRow(catName, p, i){
  const key = `${catName}::${p.nombre}::${i}`;
  const q = CART[key]||0;
  const row = document.createElement('div');
  row.className = 'prod';
  row.innerHTML = `
    <div class="prod-thumb"><img src="${p.img||'assets/placeholder.svg'}" alt=""></div>
    <div class="prod-info">
      <h4>${p.nombre}</h4>
      ${p.desc?`<p>${p.desc}</p>`:''}
      <div class="prod-price">${fmt(p.precio)}</div>
    </div>
    <div class="qty">
      <button aria-label="Quitar">−</button>
      <span class="q" id="q-${btoa(key)}">${q}</span>
      <button aria-label="Agregar">+</button>
    </div>
  `;
  const [btnMinus, , btnPlus] = row.querySelectorAll('button,span');
  btnPlus.addEventListener('click', ()=> changeQty(key, +1, p.precio));
  btnMinus.addEventListener('click', ()=> changeQty(key, -1, p.precio));
  row.dataset.key = key;
  row.dataset.price = p.precio;
  row.dataset.name = p.nombre;
  row.dataset.cat = catName;
  return row;
}

function renderCategoriasAccordion(categorias){
  const root = document.getElementById('categorias');
  root.innerHTML = '';
  categorias.forEach((cat, idx) => {
    const det = document.createElement('details');
    det.className = 'acc-item';
    det.open = idx === 0;
    det.innerHTML = `
      <summary class="acc-summary">
        <span class="acc-title">${cat.categoria}</span>
        <span class="acc-right">
          <span class="acc-badge">${(cat.productos||[]).length}</span>
          <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </summary>
      <div class="acc-content"></div>
    `;
    const content = det.querySelector('.acc-content');
    (cat.productos||[]).forEach((p, i) => content.appendChild(buildProductRow(cat.categoria, p, i)));
    det.addEventListener('toggle', () => {
      if (det.open) document.querySelectorAll('.acc-item').forEach(o => { if (o!==det) o.open=false; });
      sessionStorage.setItem('za_last_open', det.querySelector('.acc-title').textContent);
    });
    root.appendChild(det);
  });
  // restore last open
  const last = sessionStorage.getItem('za_last_open');
  if(last){
    const el = [...document.querySelectorAll('.acc-title')].find(e=>e.textContent===last);
    if(el) el.closest('details').open = true;
  }
}

function changeQty(key, delta, price){
  const q = Math.max(0, (CART[key]||0) + delta);
  CART[key] = q;
  const span = document.getElementById(`q-${btoa(key)}`);
  if(span) span.textContent = q;
  persist();
  refreshFab();
}

function persist(){
  const k = `za_cart_${slug}`;
  localStorage.setItem(k, JSON.stringify(CART));
}

function hydrate(){
  try{
    const raw = localStorage.getItem(`za_cart_${slug}`);
    if(raw) CART = JSON.parse(raw)||{};
  }catch{}
}

function refreshFab(){
  const items = Object.entries(CART).filter(([k,q])=>q>0);
  const total = items.reduce((a,[k,q])=>{
    const el = [...document.querySelectorAll('.prod')].find(n=>n.dataset.key===k);
    const price = el ? Number(el.dataset.price) : 0;
    return a + price*q;
  },0);
  $('#fabTotal').textContent = fmt(total);
  $('#fabCount').textContent = items.reduce((a, [,q])=>a+q, 0);
  $('#fab').classList.toggle('hide', items.length===0);
  renderSheetLines();
}

function renderSheetLines(){
  const lines = $('#lines'); lines.innerHTML='';
  const items = Object.entries(CART).filter(([k,q])=>q>0);
  items.forEach(([k,q])=>{
    const el = [...document.querySelectorAll('.prod')].find(n=>n.dataset.key===k);
    if(!el) return;
    const name = el.dataset.name;
    const price = Number(el.dataset.price);
    const row = document.createElement('div');
    row.className = 'line';
    row.innerHTML = `<span>${name} <span class="muted">x${q}</span></span><span>${fmt(price*q)}</span>`;
    lines.appendChild(row);
  });

  // totals
  const sub = items.reduce((a,[k,q])=>{
    const el = [...document.querySelectorAll('.prod')].find(n=>n.dataset.key===k);
    return a + (Number(el?.dataset.price)||0)*q;
  },0);

  // shipping
  const envioSel = document.querySelector('input[name=envio]:checked')?.value;
  const shipCost = (envioSel==='envio') ? Number(SHOP.ajustes?.envio_costo||0) : 0;
  const couponCode = ($('#coupon').value||'').trim().toUpperCase();
  let disc = 0;
  if(couponCode){
    const c = (SHOP.ajustes?.cupones||[]).find(x => x.code.toUpperCase()===couponCode);
    if(c){
      if(c.type==='percent') disc = Math.round(sub*(Number(c.value||0)/100));
      else if(c.type==='amount') disc = Number(c.value||0);
      else if(c.type==='shipping_free') disc = shipCost;
    }
  }
  const tipPct = Number($('#tip').value||0);
  const tipAmt = tipPct>0 ? Math.round(sub*(tipPct/100)) : 0;
  const total = Math.max(0, sub + shipCost - disc + tipAmt);

  $('#sub').textContent = fmt(sub);
  $('#ship').textContent = fmt(shipCost);
  $('#shipLine').style.display = shipCost>0 ? '' : 'none';
  $('#disc').textContent = '-'+fmt(disc);
  $('#discLine').style.display = disc>0 ? '' : 'none';
  $('#tipAmt').textContent = fmt(tipAmt);
  $('#tipLine').style.display = tipAmt>0 ? '' : 'none';
  $('#total').textContent = fmt(total);

  // warning
  const nameOk = ($('#name').value||'').trim().length>0;
  const addrOk = (envioSel!=='envio') || ($('#addr').value||'').trim().length>0;
  const warn = [];
  if(!nameOk) warn.push('Ingresá tu nombre.');
  if(envioSel==='envio' && !addrOk) warn.push('Ingresá la dirección para el envío.');
  $('#warn').textContent = warn.join(' ');
  $('#wa').disabled = !(items.length && nameOk && addrOk);
}

function openSheet(){ $('#sheet').classList.add('open'); $('#backdrop').classList.add('open'); }
function closeSheet(){ $('#sheet').classList.remove('open'); $('#backdrop').classList.remove('open'); }

async function init(){
  SHOP = await loadShop();
  // header
  $('#shopName').textContent = SHOP.nombre || 'Local';
  $('#shopSub').textContent = SHOP.subtitulo || SHOP.slogan || 'Abierto todos los días';
  document.title = `${SHOP.nombre} | Zonaap`;

  // label envío
  const ship = Number(SHOP.ajustes?.envio_costo||0);
  $('#envLbl').textContent = ship>0 ? `Envío (+${fmt(ship)})` : 'Envío';

  // data → acordeón
  const categorias = (SHOP.secciones||[]).flatMap(s => s.categorias||[]);
  hydrate();
  renderCategoriasAccordion(categorias);

  // hydrate quantities
  document.querySelectorAll('.prod').forEach(el => {
    const key = el.dataset.key;
    const q = CART[key]||0;
    const span = el.querySelector('.q');
    if(span) span.textContent = q;
  });

  // events
  $('#fab').addEventListener('click', openSheet);
  $('#close').addEventListener('click', closeSheet);
  $('#backdrop').addEventListener('click', closeSheet);
  document.querySelectorAll('input[name=envio]').forEach(i=> i.addEventListener('change', ()=>{
    const v = document.querySelector('input[name=envio]:checked')?.value;
    $('#addrWrap').style.display = (v==='envio')? 'block' : 'none';
    refreshFab();
  }));
  ['name','addr','coupon','tip','note'].forEach(id => $('#'+id).addEventListener('input', refreshFab));
  $('#clear').addEventListener('click', ()=>{ CART={}; persist(); document.querySelectorAll('.q').forEach(e=>e.textContent='0'); refreshFab(); });

  $('#wa').addEventListener('click', ()=>{
    const items = Object.entries(CART).filter(([k,q])=>q>0);
    const envioSel = document.querySelector('input[name=envio]:checked')?.value || 'retiro';
    const name = ($('#name').value||'').trim();
    const addr = ($('#addr').value||'').trim();
    const note = ($('#note').value||'').trim();
    const couponCode = ($('#coupon').value||'').trim().toUpperCase();
    // recompute totals
    const sub = items.reduce((a,[k,q])=>{
      const el = [...document.querySelectorAll('.prod')].find(n=>n.dataset.key===k);
      return a + (Number(el?.dataset.price)||0)*q;
    },0);
    const shipCost = envioSel==='envio' ? Number(SHOP.ajustes?.envio_costo||0) : 0;
    let disc = 0;
    if(couponCode){
      const c = (SHOP.ajustes?.cupones||[]).find(x => x.code.toUpperCase()===couponCode);
      if(c){
        if(c.type==='percent') disc = Math.round(sub*(Number(c.value||0)/100));
        else if(c.type==='amount') disc = Number(c.value||0);
        else if(c.type==='shipping_free') disc = shipCost;
      }
    }
    const tipPct = Number($('#tip').value||0);
    const tipAmt = tipPct>0 ? Math.round(sub*(tipPct/100)) : 0;
    const total = Math.max(0, sub + shipCost - disc + tipAmt);

    let msg = `Hola, soy ${name}. Quiero hacer un pedido en ${SHOP.nombre}:\n`;
    items.forEach(([k,q])=>{
      const el = [...document.querySelectorAll('.prod')].find(n=>n.dataset.key===k);
      msg += `- ${el?.dataset.name} x${q} - ${fmt(Number(el?.dataset.price||0)*q)}\n`;
    });
    if(note) msg += `Nota: ${note}\n`;
    if(couponCode) msg += `Cupón: ${couponCode}\n`;
    msg += (envioSel==='envio') ? `Envío a: ${addr} (+${fmt(shipCost)})\n` : 'Retiro en el local\n';
    if(tipAmt>0) msg += `Propina: ${fmt(tipAmt)}\n`;
    msg += `Total: ${fmt(total)}`;

    const wsp = (SHOP.ajustes?.whatsapp||'').replace(/\D/g,'');
    const url = `https://wa.me/${wsp}?text=${encodeURIComponent(msg)}`;
    window.open(url,'_blank');
  });

  // default selection
  document.getElementById('ret').checked = true;
  refreshFab();
}

// init
init();