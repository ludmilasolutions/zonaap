Zonaap — Fix de CMS (Decap) y estructura de datos
=================================================

Qué contiene este zip
---------------------
- admin/config.yml  → Config válida: colecciones 'listado', 'catalogo', 'promos' y 'ajustes', con preview desactivado.
- admin/index.html  → Carga Decap 3.8.3 + Identity.

Pasos
-----
1. Subí la carpeta 'admin' para reemplazar la existente.
2. Crea estas carpetas si aún no existen:
   - data/negocios/       (catálogos por local, ej: data/negocios/pizzeria-don-napo.json)
   - data/promos/         (promociones por local, ej: data/promos/pizzeria-don-napo.json)
3. Mové tus catálogos actuales a 'data/negocios'.
4. En tu negocio.html, al cargar el JSON del local, usá esta función:
   (intenta 'data/negocios/slug.json' y si no existe, prueba 'data/slug.json')

   async function loadCatalog(slug){
     const candidates = [`data/negocios/${slug}.json`, `data/${slug}.json`];
     for(const p of candidates){
       try{
         const r = await fetch(p);
         if(r.ok) { console.log('Catálogo desde', p); return await r.json(); }
       }catch(e){}
     }
     throw new Error('Catálogo no encontrado para '+slug);
   }

5. Hard reload del panel (/admin): Ctrl+F5. Si persiste algún error,
   limpia el localStorage del dominio y recargá.

Notas
-----
- El error 'removeChild' es un bug de los previews sobre JSON; ya está
  mitigado desactivando los previews en las colecciones de datos.
- Si querés mantener tus JSON en otra ruta, cambia 'folder' en la colección
  'catalogo' para que apunte a esa carpeta y asegurate de no mezclar otros JSON
  con distinto schema en esa misma ruta.
