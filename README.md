# Zonaap – Opción A (100% estático + PR automático)

Plataforma multi-tienda gratis: cada local tiene su carpeta `locales/<slug>/` con sus JSON. Registro crea un **Pull Request** al repo.

## Deploy rápido (Netlify)
1) Subí estos archivos a un repo GitHub (o importá directo en Netlify).
2) En Netlify → *Site settings* → *Environment variables*:
   - `GITHUB_OWNER` = tu usuario/org
   - `GITHUB_REPO` = nombre del repo
   - `GITHUB_DEFAULT_BRANCH` = `main` (o la que uses)
   - `GITHUB_TOKEN` = un PAT con permiso `repo` (fine-grained o classic)
3) Deploy. Abrí `/registro.html`, enviá un alta. Al aprobar el PR, el local aparece en la home.

## Estructura
- `data/locales.json` → listado para la home
- `locales/<slug>/ajustes.json` → whatsapp, shipping, horarios, logo, etc.
- `locales/<slug>/productos-*.json`, `promos-*.json`
- `negocio.html` → plantilla por slug
- `tachi-app.js` → lógica de tienda (adaptada de El Tachi)
- `netlify/functions/create-branch-pr.js` → crea rama + PR
- `netlify.toml` → funciones y redirect `/tienda/:slug`

## Apps Script (analytics/seguimiento)
En `locales/<slug>/ajustes.json` podés setear `analytics_webhook` con tu Web App de Apps Script. El payload incluye `slug`.

## Rutas útiles
- `/` → home con buscador
- `/registro.html` → alta de locales
- `/negocio.html?l=<slug>` → tienda
- `/tienda/<slug>` → redirect a lo mismo

---
Hecho para replicar el flujo de El Tachi de forma multi-tenant y sin costos.


## Add-ons incluidos
### Decap/Netlify CMS por carpeta
- Panel en **/admin/** → hace login con *Netlify Identity* y edita contenido por local en `locales/<slug>/content.json` (crea PRs).
- Activa en Netlify: **Identity** (Enable Identity) → **Git Gateway** (Enable).
- Usuarios: invita dueños de locales por email (free tier). Cada cambio va por PR.

### Temas por local
- En `ajustes.theme` podés definir variables CSS: `azul`, `amarillo`, `bg`, `text`. El runtime las aplica.

### Pantalla de seguimiento
- `/track.html?l=<slug>&o=<order_id>` consulta el `analytics_webhook` del local vía JSONP y muestra el estado.

### Compatibilidad
- La tienda ahora soporta **dos modos** de datos:
  1) `locales/<slug>/content.json` (preferido por CMS)
  2) Archivos separados `ajustes.json`, `productos-*.json`, `promos-*.json` (fallback)

