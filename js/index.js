
const grid = document.getElementById('grid');
const q = document.getElementById('q');

async function loadLocales(){
  const res = await fetch('data/locales.json');
  const data = await res.json();
  window.__locales = data.locales || [];
  render(window.__locales);
}
function render(list){
  grid.innerHTML = '';
  list.forEach(l=>{
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-logo"><img src="${l.logo_url || 'assets/logo.svg'}" width="40" height="40" alt=""></div>
      <div>
        <h3>${l.nombre}</h3>
        <p>${l.rubro} • ${l.barrio}</p>
      </div>
      <a href="negocio.html?l=${encodeURIComponent(l.slug)}">Abrir →</a>
    `;
    grid.appendChild(card);
  });
}

q.addEventListener('input', e => {
  const term = e.target.value.trim().toLowerCase();
  const filtered = (window.__locales || []).filter(l => {
    const txt = `${l.nombre} ${l.rubro} ${l.barrio}`.toLowerCase();
    return txt.includes(term);
  });
  render(filtered);
});

loadLocales();
