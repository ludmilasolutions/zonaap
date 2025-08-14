// Netlify Function: crea rama, sube archivos del nuevo local y abre un PR
// Requiere env:
// GITHUB_OWNER, GITHUB_REPO, GITHUB_DEFAULT_BRANCH, GITHUB_TOKEN
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_DEFAULT_BRANCH, GITHUB_TOKEN } = process.env;
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_DEFAULT_BRANCH || !GITHUB_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Faltan variables de entorno GitHub' }) };
  }
  function slugify(s){ return (s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  try {
    const data = JSON.parse(event.body||'{}');
    const nombre = String(data.nombre||'').trim();
    const rubro  = String(data.rubro||'').trim();
    const barrio = String(data.barrio||'').trim();
    const whatsapp = String(data.whatsapp||'').replace(/\D/g,'');
    const logo = String(data.logo||'').trim();
    const slug = slugify(data.slug || nombre);
    if (!nombre || !whatsapp || !slug) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan campos requeridos (nombre, whatsapp)' }) };
    }

    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json'
    };
    const api = (path, init={}) => fetch(`https://api.github.com${path}`, { headers, ...init });

    // 1) Obtener SHA de la rama base
    const refRes = await api(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}`);
    if (!refRes.ok) throw new Error('No se pudo leer la rama base');
    const refJson = await refRes.json();
    const baseSha = refJson.object.sha;

    // 2) Crear nueva rama
    const branchName = `alta/${slug}-${Date.now()}`;
    const newRefRes = await api(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
    });
    if (!newRefRes.ok) throw new Error('No se pudo crear la rama');

    // 3) Leer locales.json actual
    const localesPath = 'data/locales.json';
    const localesRes = await api(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${localesPath}?ref=${GITHUB_DEFAULT_BRANCH}`);
    if (!localesRes.ok) throw new Error('No se pudo leer data/locales.json');
    const localesJson = await localesRes.json();
    const localesContent = Buffer.from(localesJson.content, 'base64').toString('utf8');
    let locales = [];
    try { locales = JSON.parse(localesContent) } catch { locales = [] }

    // 4) Agregar entrada del nuevo local
    const entry = { slug, nombre, rubro, barrio, logo: logo || 'assets/logo.png', envio: true, abierto: true };
    // Evitar duplicado por slug
    locales = (locales || []).filter(l => l.slug !== slug).concat([entry]);

    // 5) Escribir archivos en la rama nueva
    async function putFile(path, content, message){
      const res = await api(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(path)}`, {
        method: 'PUT',
        body: JSON.stringify({
          message,
          content: Buffer.from(content, 'utf8').toString('base64'),
          branch: branchName
        })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`PUT ${path} → ${res.status}: ${t}`);
      }
    }

    // locales/<slug>/*
    const ajustes = {
      nombre, sub: 'Hacé tu pedido desde la web', logo: entry.logo,
      whatsapp, shipping: 1000, analytics_webhook: '',
      horarios: {
        rotiseria: { dias:[4,5,6,0], rangos:[{desde:'19:30', hasta:'22:30'}] },
        bebidas:   { dias:[0,1,2,3,4,5,6], rangos:[{desde:'09:00', hasta:'23:59'}] }
      }
    };
    const productosRot = { categorias:[{ categoria:'PIZZAS', productos:[{nombre:'Muzza',precio:3500},{nombre:'Napolitana',precio:4500}] }] };
    const productosBeb = { categorias:[{ categoria:'BEBIDAS', productos:[{nombre:'Coca 1.5L',precio:3200}] }] };
    const promosEmpty = { promos: [] };

    await putFile(`locales/${slug}/ajustes.json`, JSON.stringify(ajustes, null, 2), `Alta ${slug}: ajustes.json`);
    await putFile(`locales/${slug}/productos-rotiseria.json`, JSON.stringify(productosRot, null, 2), `Alta ${slug}: productos-rotiseria.json`);
    await putFile(`locales/${slug}/productos-bebidas.json`, JSON.stringify(productosBeb, null, 2), `Alta ${slug}: productos-bebidas.json`);
    await putFile(`locales/${slug}/promos-rotiseria.json`, JSON.stringify(promosEmpty, null, 2), `Alta ${slug}: promos-rotiseria.json`);
    await putFile(`locales/${slug}/promos-bebidas.json`, JSON.stringify(promosEmpty, null, 2), `Alta ${slug}: promos-bebidas.json`);

    // data/locales.json actualizado
    await putFile(localesPath, JSON.stringify(locales, null, 2), `Alta ${slug}: agregar a data/locales.json`);

    // 6) Crear PR
    const prRes = await api(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title: `Alta de local: ${nombre} (${slug})`,
        head: branchName,
        base: GITHUB_DEFAULT_BRANCH,
        body: `Se crea carpeta de local **${nombre}** y se actualiza \`data/locales.json\`.
- Rubro: ${rubro}
- Barrio: ${barrio}
- WhatsApp: ${whatsapp}`
      })
    });
    if (!prRes.ok) throw new Error('No se pudo crear el PR');
    const pr = await prRes.json();

    return { statusCode: 200, body: JSON.stringify({ ok: true, pr_url: pr.html_url, branch: branchName }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}
