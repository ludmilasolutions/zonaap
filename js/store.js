
/* ===== Helpers ===== */
const Q = sel => document.querySelector(sel);
const QA = sel => Array.from(document.querySelectorAll(sel));
const fmt = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n||0);
const params = new URLSearchParams(location.search);
const SLUG = params.get('l') || '';

let LOCALE = null;
let SHIPPING = 0;
let WHATS = '';
let CART = {}; // id -> qty
let COUPONS = [];
let CUPON_APLICADO = null;

function toast(msg,type='ok',t=2200){
  const wrap=Q('#toastWrap'); if(!wrap) return;
  const el=document.createElement('div'); el.className='toast '+(type==='error'?'err':type==='warn'?'warn':'ok'); el.textContent=msg;
  wrap.appendChild(el); setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .2s'},t); setTimeout(()=>wrap.removeChild(el),t+240);
}

async function loadStore(){
  if(!SLUG){ document.body.innerHTML = '<p style="padding:2rem">Falta parámetro ?l=</p>'; return; }
  const r = await fetch(`locales/${SLUG}/content.json`);
  LOCALE = await r.json();
  const aj = LOCALE.ajustes || {};
  Q('#storeTitle').textContent = aj.nombre || '—';
  Q('#storeSub').textContent = aj.sub || '';
  if(aj.logo) Q('#storeLogo').src = aj.logo;
  document.title = (aj.nombre || 'Tienda')+' | Zonaap';
  SHIPPING = Number(aj.shipping||0);
  WHATS = (aj.whatsapp||'').toString().replace(/\D/g,'');
  COUPONS = Array.isArray(aj.cupones)?aj.cupones:[];
  buildTabs(aj.secciones||['Sección 1','Sección 2']);
  renderMenus();
  buildCatNav('sec1'); buildCatNav('sec2');
  bindCart();
}

function buildTabs(names){
  const tabs = Q('#tabs'); tabs.innerHTML='';
  const b1 = document.createElement('button'); b1.textContent = names[0] || 'Sección 1'; b1.className='active'; b1.onclick = ()=>showSec('sec1');
  const b2 = document.createElement('button'); b2.textContent = names[1] || 'Sección 2'; b2.onclick = ()=>showSec('sec2');
  tabs.appendChild(b1); tabs.appendChild(b2);
}
function showSec(sec){
  Q('#menu-sec1').style.display = sec==='sec1'?'block':'none';
  Q('#menu-sec2').style.display = sec==='sec2'?'block':'none';
  const [b1,b2] = QA('#tabs button'); b1.classList.toggle('active',sec==='sec1'); b2.classList.toggle('active',sec==='sec2');
}

function normalizar(d){ return Array.isArray(d?.categorias)?Object.fromEntries(d.categorias.map(c=>[c.categoria,c.productos||[]])):{}; }

function renderProductos(contId, data){
  const cont = Q('#'+contId); cont.innerHTML='';
  const norm = normalizar(data);
  Object.keys(norm).forEach(cat=>{
    const items = norm[cat]||[];
    const det = document.createElement('details');
    det.id = 'cat-'+contId+'-'+cat.replace(/\s+/g,'-').toLowerCase();
    const sum = document.createElement('summary'); sum.textContent=cat; det.appendChild(sum);
    items.forEach((p,i)=>{
      const id = `${contId}-${cat}-${i}`;
      const div = document.createElement('div'); div.className='producto';
      const img = p.img || 'assets/placeholder.png';
      div.dataset.nombre = p.nombre; div.dataset.precio = p.precio;
      div.innerHTML = `
        <div class="prod-thumb"><img src="${img}" alt="${p.nombre}"></div>
        <div class="producto-info">
          <h3>${p.nombre}</h3>
          ${p.desc?`<p>${p.desc}</p>`:''}
          <div class="price-wrap"><span class="price-new">${fmt(p.precio)}</span></div>
        </div>
        <div class="contador">
          <button aria-label="Quitar" data-id="${id}" data-d="-1">−</button>
          <span id="cantidad-${id}">0</span>
          <button aria-label="Agregar" data-id="${id}" data-d="1">+</button>
        </div>`;
      cont.appendChild(det); det.appendChild(div);
      if(!(id in CART)) CART[id]=0;
    });
    cont.appendChild(det);
  });
}

function renderMenus(){
  renderProductos('menu-sec1', LOCALE.sec1 || {categorias:[]});
  renderProductos('menu-sec2', LOCALE.sec2 || {categorias:[]});
  showSec('sec1');
}

function buildCatNav(sec){
  const cont = Q('#catNav'); cont.innerHTML='';
  const details = QA(`#menu-${sec} details`);
  details.forEach(d=>{
    const id = d.id || ('cat-'+Math.random().toString(36).slice(2));
    d.id = id;
    const title = d.querySelector('summary')?.textContent || 'Cat';
    const a = document.createElement('a'); const count = d.querySelectorAll('.producto').length;
    a.innerHTML = `${title} <small>(${count})</small>`; a.href = '#'+id; a.className='cat-chip';
    cont.appendChild(a);
  });
  // Active chip on scroll
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{ if(e.isIntersecting){ QA('#catNav .cat-chip').forEach(a=>a.classList.toggle('active', a.hash==='#'+e.target.id)); } });
  },{rootMargin:'-60% 0px -35% 0px',threshold:0.01});
  details.forEach(d=>io.observe(d));
}

/* ===== Cart mechanics ===== */
function bindCart(){
  document.body.addEventListener('click',e=>{
    const btn = e.target.closest('button[data-id]'); if(!btn) return;
    const id = btn.dataset.id; const d = Number(btn.dataset.d||0);
    if(!(id in CART)) CART[id]=0; CART[id]=Math.max(0, CART[id]+d);
    const span = Q('#cantidad-'+id); if(span) span.textContent = CART[id];
    updateSummary();
  });
  Q('#btn-vaciar').addEventListener('click',()=>{ Object.keys(CART).forEach(k=>CART[k]=0); QA('[id^="cantidad-"]').forEach(el=>el.textContent='0'); updateSummary(); });
  Q('#btn-whatsapp').addEventListener('click',sendWhatsApp);
}

function countItems(){ return Object.values(CART).reduce((a,b)=>a+(b||0),0); }
function setFabVisible(v){
  const fab = Q('#cartFab'); if(!fab) return;
  if(v){ fab.removeAttribute('hidden'); requestAnimationFrame(()=>fab.classList.remove('hide')); }
  else{ fab.classList.add('hide'); setTimeout(()=>fab.setAttribute('hidden',''),180); }
}

function updateSummary(){
  const lista = Q('#lista'); lista.innerHTML='';
  let subtotal=0; let count=0;
  Object.entries(CART).forEach(([id,qty])=>{
    if(qty<=0) return;
    const span=Q('#'+`cantidad-${id}`); if(!span) return;
    const row=span.closest('.producto'); const name=row?.dataset?.nombre||''; const price=parseInt(row?.dataset?.precio||0,10);
    const li=document.createElement('li'); li.className='resumen-item';
    li.innerHTML=`<span class="resumen-name">${name}</span><span>x${qty}</span><span>${fmt(price*qty)}</span>`;
    lista.appendChild(li); subtotal+=price*qty; count+=qty;
  });
  const envioSel = Q('input[name=envio]:checked')?.value || '';
  const shipping = envioSel==='envio' ? SHIPPING : 0;
  const cuponTxt = Q('#cupon').value.trim().toUpperCase();
  const propPct = Math.max(0, Math.min(100, Number(Q('#propina').value||0)));

  // Cupon
  let descuento = 0;
  CUPON_APLICADO = null;
  if(cuponTxt){
    const found = COUPONS.find(c=>c.code.toUpperCase()===cuponTxt);
    if(found){
      CUPON_APLICADO = found;
      if(found.type==='percent'){ descuento = Math.round(subtotal * (Number(found.value||0)/100)); }
      if(found.type==='amount'){ descuento = Number(found.value||0); }
      if(found.type==='shipping_free'){ /* handled by shipping = 0 */ }
    }
  }
  const envioFinal = (CUPON_APLICADO && CUPON_APLICADO.type==='shipping_free') ? 0 : shipping;
  const propina = Math.round(subtotal * (propPct/100));
  const total = Math.max(0, subtotal - descuento) + envioFinal + propina;

  Q('#subtotal').textContent = fmt(subtotal);
  Q('#envioLine').hidden = envioFinal<=0; Q('#envioCosto').textContent = fmt(envioFinal);
  Q('#descMonto').textContent = fmt(descuento);
  Q('#propMonto').textContent = fmt(propina);
  Q('#total').textContent = fmt(total);
  Q('#emptyMsg').hidden = count>0;
  Q('#fabCount').textContent = count;
  Q('#fabTotal').textContent = fmt(total);
  setFabVisible(count>0 && !window.sheetOpen);
  Q('#btn-whatsapp').disabled = !(count>0 && Q('#nombre').value.trim());
}

window.sheetOpen=false;
function openSheet(){ if(window.sheetOpen) return; window.sheetOpen=true; Q('#cartSheet').classList.add('open'); Q('#sheetBackdrop').classList.add('open'); document.body.style.overflow='hidden'; setFabVisible(false); }
function closeSheet(){ if(!window.sheetOpen) return; window.sheetOpen=false; Q('#cartSheet').classList.remove('open'); Q('#sheetBackdrop').classList.remove('open'); document.body.style.overflow=''; updateSummary(); }
Q('#cartFab').addEventListener('click', e=>{e.preventDefault(); openSheet();});
Q('#sheetClose').addEventListener('click', closeSheet);
Q('#sheetBackdrop').addEventListener('click', closeSheet);
['#nombre','#direccion','#cupon','#propina'].forEach(sel=>{ const el=Q(sel); el&&el.addEventListener('input', updateSummary); });
QA('input[name=envio]').forEach(r=>r.addEventListener('change', updateSummary));

function sendWhatsApp(){
  const name = Q('#nombre').value.trim();
  const addr = Q('#direccion').value.trim();
  const envioSel = Q('input[name=envio]:checked')?.value || 'retiro';
  if(!name){ toast('Ingresá tu nombre','error'); return; }
  if(countItems()===0){ toast('Seleccioná al menos un producto','error'); return; }
  if(envioSel==='envio' && !addr){ toast('Ingresá tu dirección para el envío','error'); return; }
  let msg=`Hola, soy ${name}. Quiero hacer un pedido:\\n`;
  Object.entries(CART).forEach(([id,qty])=>{
    if(qty<=0) return; const span=Q('#cantidad-'+id); if(!span) return; 
    const row=span.closest('.producto'); const n=row?.dataset?.nombre||''; const p=parseInt(row?.dataset?.precio||0,10); const line=p*qty;
    msg+=`- ${n} x${qty} - ${fmt(line)}\\n`;
  });
  const tSub = Q('#subtotal').textContent;
  const tEnv = !Q('#envioLine').hidden ? Q('#envioCosto').textContent : fmt(0);
  const tDesc = Q('#descMonto').textContent;
  const tProp = Q('#propMonto').textContent;
  const tTot = Q('#total').textContent;
  const nota = Q('#notaGeneral').value.trim();
  if(envioSel==='envio'){ msg+=`Envío a: ${addr}\\n`; } else { msg+='Retiro por el local\\n'; }
  if(nota) msg+=`Nota: ${nota}\\n`;
  const cup = Q('#cupon').value.trim().toUpperCase(); if(cup) msg+=`Cupón: ${cup}\\n`;
  msg+=`Subtotal: ${tSub}\\n`; if(!Q('#envioLine').hidden) msg+=`Envío: ${tEnv}\\n`; if(tDesc!==fmt(0)) msg+=`Descuento: ${tDesc}\\n`; if(tProp!==fmt(0)) msg+=`Propina: ${tProp}\\n`; msg+=`Total: ${tTot}`;
  const phone = WHATS || '0000000000';
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
  // Clean cart
  Object.keys(CART).forEach(k=>CART[k]=0); QA('[id^="cantidad-"]').forEach(el=>el.textContent='0'); updateSummary(); closeSheet();
  toast('Pedido enviado. Carrito vaciado ✅','ok',2200);
}

document.addEventListener('DOMContentLoaded', ()=>{
  loadStore().then(()=>updateSummary());
});
