# Zonaap — Demo full con carrito estilo Tachi + categorías en acordeón

Abrí `index.html` para ver el listado de locales. Al entrar a un local (`negocio.html?l=<slug>`) vas a ver:

- Categorías **una debajo de la otra** en **acordeón** (solo una abierta a la vez).
- Carrito con **FAB flotante** y **bottom-sheet** de 3 pasos (Datos → Resumen → WhatsApp).
- **Retiro / Envío** con costo dinámico por local, **cupón** (porcentaje, monto o envío gratis), **propina** (%), **nota** y **totales**.

## Estructura
- `index.html` • Home con buscador y tarjetas de locales.
- `negocio.html` • Página del local (acordeón + carrito).
- `js/app.js` • Lógica del home.
- `js/store.js` • Lógica del local y del carrito.
- `locales/index.json` • Listado de locales (slug, nombre, rubro, barrio, logo).
- `locales/<slug>/content.json` • Configuración y productos del local.

## Configuración por local (`content.json`)
```jsonc
{
  "subtitulo": "Hecha como en casa",
  "ajustes": {
    "whatsapp": "+5493415550000",
    "envio_costo": 1200,
    "cupones": [
      { "code": "NAPO10", "type": "percent", "value": 10 },
      { "code": "ENVIOFREE", "type": "shipping_free" }
    ]
  },
  "secciones": [
    { "nombre": "Pizzas", "categorias": [ { "categoria":"Clásicas", "productos":[ ... ] } ] }
  ]
}
```

**Tipos de cupón**: `percent` (porcentaje), `amount` (monto fijo en ARS), `shipping_free` (envío gratis).

---

> Sugerencia: subí la carpeta a Netlify (drag & drop) y listo. Si querés conectar hoja de Google/Apps Script para analíticas y tracking, se puede agregar en otra iteración.
