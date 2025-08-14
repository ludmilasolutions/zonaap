(function(){
  async function loadLocales(){
    const res = await fetch('locales/index.json');
    const data = await res.json();
    return data.locales || [];
  }
  function card(l){
    return `<a class="shop" href="negocio.html?l=${encodeURIComponent(l.slug)}" aria-label="${l.nombre}">
      <img src="${l.logo||'assets/za-icon.svg'}" alt="">
      <div>
        <div class="name">${l.nombre}</div>
        <div class="pill">${l.rubro} • ${l.barrio}</div>
      </div>
    </a>`;
  }
  function render(locales, q=''){
    const cont = document.getElementById('list');
    const normQ = (q||'').toLowerCase();
    const items = locales.filter(l => [l.nombre,l.rubro,l.barrio].join(' ').toLowerCase().includes(normQ));
    cont.innerHTML = items.map(card).join('') || '<p style="margin:8px 0 0;color:#6a7b97">No se encontraron locales.</p>';
  }
  let LOCALES=[];
  loadLocales().then(l => { LOCALES=l; render(LOCALES); });
  const q = document.getElementById('q');
  q.addEventListener('input', () => render(LOCALES, q.value));
})();