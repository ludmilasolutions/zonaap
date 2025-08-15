
Zonaap – Build estático listo
=============================

Abrí `index.html` para ver la home. Entrá a un negocio con `negocio.html?l=<slug>`.

Datos (JSON)
------------
- `data/locales.json`: tarjetas de la home.
- `data/ajustes.json`: whatsapp y costo de envío por defecto.
- `data/negocios/<slug>.json`: catálogo por local.
- `data/promos/<slug>.json` (opcional): promos para insertar arriba.

CMS (Decap)
-----------
Panel en `/admin/` (Netlify Identity). Collections:
- Listado (Home)  → `data/locales.json`
- Catálogo por local → `data/negocios`
- Promos → `data/promos`
- Ajustes → `data/ajustes.json`

UI
--
- Categorías en acordeón (todas cerradas al inicio; al abrir una, se cierra la anterior).
- FAB de carrito con total y cantidad; sheet de 3 pasos.
- WhatsApp: respeta Retiro/Envío, nombre y dirección (si aplica).

