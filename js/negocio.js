
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const params = new URLSearchParams(location.search);
const slug = params.get('l') || '';
const catsEl = $('#cats');

let SHIPPING = 1200;
let WSP_NUMBER = '3415923882';

const cart = {}; // key -> {name, price, qty}

function formatARS(n){ try { return new Intl.NumberFormat('es-AR',{style:'currency', currency:'ARS', maximumFractionDigits:0}).format(n); } catch { return `$ ${n}`; } }

async function loadData(){
  const ajustes = await fetch('data/ajustes.json').then(r=>r.json()).catch(()=>({shipping:1200, whatsapp:'3415923882'}));
  SHIPPING = ajustes.shipping || 1200;
  WSP_NUMBER = (ajustes.whatsapp || '3415923882').replace(/\D/g,'');

  const neg = await fetch(`data/negocios/${slug}.json`).then(r=>r.json());
  const promos = await fetch(`data/promos/${slug}.json`).then(r=>r.json()).catch(()=>null);

  $('#negTitle').textContent = neg.nombre || 'Negocio';
  $('#negSub').textContent = neg.subtitulo || 'Abierto todos los días';

  let cats = neg.categorias || [];
  // Insert "Promos" on top, if any
  if (promos && Array.isArray(promos.promos) && promos.promos.length){
    cats = [{
      categoria: '⭐ Promos',
      productos: promos.promos.map(p => ({nombre:p.nombre, desc:p.desc||'', precio:p.precio, img:p.img||''}))
    }, ...cats];
  }
  renderCats(cats);
}

function renderCats(cats){
  catsEl.innerHTML = '';
  cats.forEach((c,i)=>{
    const det = document.createElement('details');
    det.className = 'accordion';
    // all closed initially
    const sum = document.createElement('summary');
    sum.innerHTML = `<span>${c.categoria}</span><span>▾</span>`;
    det.appendChild(sum);

    const body = document.createElement('div');
    body.className = 'acc-body';
    (c.productos||[]).forEach((p,idx)=>{
      const id = `${i}-${idx}`;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="thumb"><img src="${p.img || 'assets/placeholder.svg'}" width="60" height="60" alt=""></div>
        <div>
          <h4>${p.nombre}</h4>
          ${p.desc? `<p>${p.desc}</p>`:''}
          <div class="price">${formatARS(p.precio||0)}</div>
        </div>
        <div class="counter">
          <button data-id="${id}" data-name="${p.nombre}" data-price="${p.precio}" data-d="-1">−</button>
          <span id="qty-${id}">0</span>
          <button data-id="${id}" data-name="${p.nombre}" data-price="${p.precio}" data-d="1">+</button>
        </div>
      `;
      body.appendChild(row);
    });
    det.appendChild(body);
    catsEl.appendChild(det);
  });

  // only one open at a time
  catsEl.addEventListener('toggle', e => {
    if (e.target.tagName === 'DETAILS' && e.target.open){
      $$('#cats details').forEach(d => { if (d!==e.target) d.open = false; });
    }
  }, {capture:true});

  catsEl.addEventListener('click', onQtyClick);
}

function onQtyClick(e){
  if (e.target.tagName !== 'BUTTON') return;
  const btn = e.target;
  const id = btn.dataset.id;
  const delta = parseInt(btn.dataset.d,10);
  const name = btn.dataset.name;
  const price = parseInt(btn.dataset.price||'0',10);

  if (!cart[id]) cart[id] = {name, price, qty:0};
  cart[id].qty = Math.max(0, (cart[id].qty||0) + delta);
  const span = document.getElementById(`qty-${id}`);
  if (span) span.textContent = cart[id].qty;

  saveCart();
  updateFab();
}

function countItems(){ return Object.values(cart).reduce((a,b)=>a+(b.qty||0),0); }
function sumTotal(){ return Object.values(cart).reduce((a,b)=>a + (b.price||0)*(b.qty||0), 0); }

function updateFab(){
  const fab = $('#fab');
  const cnt = countItems();
  $('#fabCount').textContent = cnt;
  $('#fabTotal').textContent = formatARS(sumTotal());
  fab.hidden = cnt<=0;
}

function saveCart(){
  try { localStorage.setItem('za_cart', JSON.stringify(cart)); } catch {}
}
function loadCart(){
  try { const o = JSON.parse(localStorage.getItem('za_cart')||'{}'); Object.assign(cart, o||{}); } catch {}
}

function openSheet(){
  $('#backdrop').classList.add('open');
  $('#sheet').classList.add('open');
  updateSteps();
  renderSummary();
}
function closeSheet(){
  $('#backdrop').classList.remove('open');
  $('#sheet').classList.remove('open');
}

function updateSteps(){
  const envioInput = document.querySelector('input[name=envio]:checked');
  const datosOk = ($('#nombre').value.trim().length>0) && !!envioInput &&
                  (envioInput.value==='retiro' || $('#direccion').value.trim().length>0);
  const hayItems = countItems()>0;
  let activo = 1; if (datosOk) activo = 2; if (datosOk && hayItems) activo = 3;
  $$('#steps .step').forEach(s => s.classList.toggle('active', Number(s.dataset.step)===activo));
}

function renderSummary(){
  const wrap = $('#summary'); wrap.innerHTML = '';
  Object.values(cart).filter(i=>i.qty>0).forEach(i=>{
    const row = document.createElement('div');
    row.className = 'resume-row';
    row.innerHTML = `<div><strong class="small">${i.name}</strong></div><div class="small">x${i.qty}</div><div><strong>${formatARS(i.qty*i.price)}</strong></div>`;
    wrap.appendChild(row);
  });

  const envioSel = document.querySelector('input[name=envio]:checked');
  const envioCost = envioSel && envioSel.value==='envio' ? SHIPPING : 0;
  const sub = sumTotal();
  const total = sub + envioCost;

  const t = $('#totals');
  t.innerHTML = `
    <div class="resume-line"><span>Subtotal</span><strong>${formatARS(sub)}</strong></div>
    ${envioCost? `<div class="resume-line"><span>Envío</span><strong>${formatARS(envioCost)}</strong></div>`:''}
    <div class="resume-line"><span>Total</span><strong>${formatARS(total)}</strong></div>
  `;
  $('#note').textContent = envioSel && envioSel.value==='envio' ? `Costo de envío configurado por el local: ${formatARS(SHIPPING)}` : '';
}

function sendWA(){
  const envioInput = document.querySelector('input[name=envio]:checked');
  const name = $('#nombre').value.trim();
  const addr = $('#direccion').value.trim();

  if (!envioInput){ alert('Seleccioná Retiro o Envío'); return; }
  if (!name){ alert('Ingresá tu nombre'); return; }
  if (countItems()===0){ alert('Seleccioná al menos un producto'); return; }
  if (envioInput.value==='envio' && !addr){ alert('Ingresá tu dirección'); return; }

  let msg = `Hola, soy ${name}. Quiero hacer un pedido:%0A`;
  Object.values(cart).filter(i=>i.qty>0).forEach(i=>{
    msg += `- ${i.name} x${i.qty} - ${formatARS(i.qty*i.price)}%0A`;
  });
  const envioCost = envioInput.value==='envio' ? SHIPPING : 0;
  const total = sumTotal() + envioCost;
  if (envioCost>0) msg += `Envío a: ${addr} (+${formatARS(envioCost)})%0A`;
  else msg += `Retiro en el local%0A`;
  msg += `Total: ${formatARS(total)}`;

  window.open(`https://wa.me/${WSP_NUMBER}?text=${msg}`, '_blank');
}

function clearCart(){
  Object.keys(cart).forEach(k => cart[k].qty = 0);
  $$('#summary').innerHTML = '';
  $$('#cats [id^="qty-"]').forEach(el => el.textContent = '0');
  saveCart();
  updateFab();
  renderSummary();
}

/* Events */
$('#fab').addEventListener('click', openSheet);
$('#sClose').addEventListener('click', closeSheet);
$('#backdrop').addEventListener('click', closeSheet);
$('#wa').addEventListener('click', sendWA);
$('#clear').addEventListener('click', clearCart);
$$('input[name=envio]').forEach(r => r.addEventListener('change', ()=>{ renderSummary(); updateSteps(); }));
$('#nombre').addEventListener('input', updateSteps);
$('#direccion').addEventListener('input', updateSteps);

/* Init */
loadCart();
loadData().then(()=>{ updateFab(); });
