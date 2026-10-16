# Dragons El Puig — Calendario

Web estática (HTML + CSS + JS, sin build) que lee los partidos desde una hoja de Google Sheets publicada como CSV.

## Estructura
```
index.html          Portada del club (hero, próxima jornada, resultados, equipos, pie)
noticias.html       Noticias de la prensa local (tarjetas)
partidos.html       Lista completa de partidos con filtros
calendario.html     Vista mensual con fines de semana libres
css/                nav.css (menú), club.css (portada, pie), partidos.css, calendario.css, theme.css (modo claro/oscuro)
api/partidos.js     Función de Vercel: lee la pestaña Partidos de la hoja privada
api/noticias.js     Función de Vercel: lee la pestaña Noticias de la hoja privada
lib/sheets.js       Acceso a Google Sheets (cuenta de servicio, solo lectura, sin librerías)
js/config.js        TUS DATOS: hojas de Google (partidos y noticias), Instagram, email y pista
js/footer.js        Pie de página único
js/nav.js           Botón del menú en móvil
js/theme.js         Modo claro/oscuro (recuerda la elección; por defecto sigue al sistema)
js/shared.js        URL de la hoja, parser CSV, caché, descarga, logos y partidos
js/club.js          Lógica de la portada
js/noticias.js      Lógica de noticias.html
js/partidos.js      Lógica de partidos.html
js/calendario.js    Lógica de calendario.html
img/escudo.png      Escudo del club
img/fpcv.png        Logo de la federación (pie de página)
img/noticias/       Imágenes de las noticias (ver LEEME.txt)
logos/              Escudos de rivales (ver logos/LEEME.txt)
vercel.json         Cabeceras de seguridad y caché
```

## Pendiente de personalizar en index.html
- Instagram, email y pista: se editan en `js/config.js` (valen para todas las páginas).
- Texto del hero si quieres un lema propio.

## Cambiar la hoja de datos
Edita `SHEET_CSV_URL` en `js/shared.js`. Columnas esperadas:
`Categoría, Fecha, Hora, Instalación / Pista, Jornada, Equipo Local, Equipo Visitante, Resultado, Mapa`.

## Probar en local
```
python3 -m http.server 8000
```
y abre http://localhost:8000

## Despliegue
1. Subir a GitHub (rama `main`).
2. Vercel → Add New Project → importar el repo (Framework: *Other*, sin build ni carpeta de salida).
3. Cloudflare → DNS: CNAME del dominio hacia `cname.vercel-dns.com` (en modo "solo DNS" al principio) y añadir el dominio en Vercel.

## Enlaces con filtro
`partidos.html?cat=Infantil` abre la lista ya filtrada. Valores válidos: `PreBenjamín`, `Benjamín`, `Alevín`, `Infantil`, `Juvenil`, o una categoría concreta como `Benjamín Negro`. Las tarjetas de equipos de la portada usan estos enlaces.

## Seguridad
- **Datos de la hoja = no confiables.** `buildFixtures` (shared.js) y `buildAll` (calendario.js) limpian cada campo (`clean`) y solo admiten enlaces de mapa `https` (`safeUrl`). Cualquier código nuevo que pinte datos debe usar esos objetos ya limpios, o `esc()` si pinta otros textos.
- **Sin código en atributos HTML** (`onclick`, `onerror`…): así la CSP puede prohibir scripts inline.
- **Cabeceras** en `vercel.json`: CSP, HSTS, Permissions-Policy, COOP, X-Frame-Options, nosniff y Referrer-Policy. Si añades un servicio externo (analítica, mapas incrustados, otra fuente), hay que permitir su dominio en la CSP.
- Mantén la hoja de Google **sin permiso de edición público** y activa la verificación en dos pasos en GitHub, Vercel, Cloudflare y la cuenta de Google que posee la hoja.

## Noticias
Se leen de una pestaña **Noticias** de la misma hoja de Google, publicada como CSV. Columnas:
`Fecha, Título, Texto, Fuente, Enlace, Imagen, Visible`.
- **Fecha**: `dd/mm/aaaa`. **Título**: obligatorio. **Texto**: breve (máx. 300 caracteres).
- **Fuente**: nombre del periódico. **Enlace**: dirección de la noticia (solo `https`).
- **Imagen** (opcional): nombre de un archivo subido a `img/noticias/`. Sin imagen se muestra tarjeta de solo texto.
- **Visible**: escribe `NO` para ocultar una noticia sin borrarla.

Para activarlo, pega la URL CSV de esa pestaña en `noticiasCsv` de `js/config.js`. Mientras esté vacía, la sección de la portada no aparece.

## Aviso sobre estilos
Cada página carga solo los CSS que necesita (`partidos.html` → partidos.css; `index.html` y `noticias.html` → club.css; `calendario.html` → calendario.css; todas → nav.css y theme.css). No cargues `club.css` en `partidos.html` ni en `calendario.html`: comparten nombres de clase y se pisarían los estilos.

## Partidos aplazados
Escribe `APLAZADO` en la columna **Resultado** de la hoja (vale cualquier mayúscula/minúscula).
- **No** cuenta como "próximo partido" (ni en la portada ni en el contador). En la **tarjeta de próximos partidos** de partidos.html se muestra en naranja con la etiqueta APLAZADO, seguido del siguiente partido que sí se juega; el contador va siempre a ese siguiente partido.
- En **partidos.html** sigue en la pestaña *Próximos* con la etiqueta naranja "Aplazado" (aunque su fecha original ya haya pasado) y nunca pasa a *Jugados*.
- En el **calendario**, el día se pinta en **naranja** (tiene prioridad sobre el rojo si ese día hay otros partidos) y el detalle marca el partido como aplazado.
- Cuando se fije la nueva fecha: cambia la columna **Fecha** y borra `APLAZADO` de **Resultado**.

## Actualizar la web sin perder tus datos
Tus datos (URL de noticias, Instagram, email, pista) viven **solo** en `js/config.js`. Al subir una versión nueva a GitHub, **no sobrescribas `js/config.js`**: sube todo lo demás.

## Configuración personal: js/config.js
Todos los datos que son tuyos (hoja de partidos, hoja de noticias, Instagram, email y pista) viven **solo** en `js/config.js`.
**Al actualizar la web con un zip nuevo, no subas `js/config.js`** (o vuelve a rellenarlo): si lo sobrescribes con el del zip se borran tus datos y, por ejemplo, desaparecen las noticias.
Si ya lo perdiste, puedes recuperar los valores antiguos desde el historial de GitHub (archivo → *History*).

## Origen privado de datos (hoja NO publicada)
En lugar de publicar la hoja como CSV, la web puede leerla a través de `/api/partidos` y `/api/noticias` (funciones de Vercel).
- **Variables de entorno en Vercel** (Settings → Environment Variables; nunca en GitHub):
  - `GOOGLE_SERVICE_ACCOUNT_JSON`: contenido completo del archivo .json de la cuenta de servicio.
  - `SHEET_ID`: identificador de la hoja (la parte larga de su dirección).
  - Opcionales: `TAB_PARTIDOS`, `TAB_NOTICIAS` (por defecto `Partidos` y `Noticias`).
- La hoja se comparte solo con el email de la cuenta de servicio, como **Lector**. No se publica.
- Solo se envían a la web las columnas esperadas; cualquier otra columna de la hoja se queda en el servidor.
- La respuesta se guarda 60 s en la caché de Vercel (los cambios de la hoja tardan hasta 1 minuto en verse).
- Para activarlo, en `js/config.js`: `partidosCsv: "/api/partidos"` y `noticiasCsv: "/api/noticias"`.
- Nunca subas el archivo .json de la cuenta de servicio a GitHub.

## Zona privada (acceso por invitación + mensajes por niveles)
- **Páginas:** `acceso.html` (entrar, recuperar contraseña, crear contraseña desde el enlace del correo) y `privado.html` (mensajes).
- **Funciones:** `api/auth.js` (sesión), `api/mensajes.js` (mensajes), `lib/auth.js`, `lib/privado.js`.
- **Variables de entorno en Vercel:** `SUPABASE_URL` (dirección del proyecto, `https://xxxx.supabase.co`) y `SUPABASE_ANON_KEY` (clave pública *anon/publishable*). Opcionales: `TAB_USUARIOS`, `TAB_MENSAJES`.
- **Quién entra:** Supabase comprueba email y contraseña (registro libre desactivado; se invita desde *Authentication → Users → Invite user*).
- **Qué ve cada cual:** lo decide la pestaña `Usuarios` de la hoja (columnas `Email`, `Nivel`). Sin fila en esa pestaña = sin acceso, aunque la cuenta exista. Los cambios tardan hasta 30 s.
- **Niveles:** `familia` (ve mensajes `familia`), `entrenador` y `delegado` (ven `familia` y `entrenador`), `directiva` (ve todo).
- **Mensajes:** pestaña `Mensajes` con columnas `Fecha`, `Título`, `Texto`, `Visible para` (`familia`, `entrenador` o `directiva`; vacío = `familia`) y `Activo` (`NO` para ocultar).
- **Seguridad:** la sesión va en cookies HttpOnly/Secure/SameSite=Strict (la de refresco solo se envía a `/api/auth`); las respuestas privadas no se cachean; las peticiones que cambian algo solo valen desde la propia web; límite de intentos de acceso; los mensajes se pintan como texto, nunca como HTML.
