# Rancho Las Lomas

App interna del Rancho Las Lomas: mapa del rancho con espiaderos, censo simultáneo de venado cola blanca, bitácora de machos y medidor de distancias.

Es una **web app**: se abre en **https://app.rancholaslomas.com.mx** desde el iPhone, sin instalar nada. El personal puede agregarla a la pantalla de inicio para usarla como app. Hecha con Expo (React Native para web) y Supabase; el mismo código puede compilarse como app nativa de iPhone más adelante (sección 9).

| Fase | Contenido | Estado |
|---|---|---|
| a | Proyecto base, tema, acceso con código de invitado, importador de KML, mapa con datos de prueba | Lista |
| b | Censo simultáneo con avisos (push) y tiempo real | Pendiente |
| c | Bitácora de machos | Pendiente |
| d | Distancias | Pendiente |

---

## 1. Lo que necesitas en tu computadora

- **Node.js 22** o más reciente: descárgalo de nodejs.org (versión LTS) e instálalo.
- **Git**: en Mac ya viene; si te pide instalar "herramientas de línea de comandos", acepta.
- El código: abre la app **Terminal** y escribe:

```bash
git clone https://github.com/altrevino/appRanchoLasLomas.git
```

```bash
cd appRanchoLasLomas && npm install
```

Todos los comandos de este documento se escriben en la Terminal, dentro de la carpeta `appRanchoLasLomas`.

---

## 2. Configurar Supabase (una sola vez)

Supabase guarda los datos, los usuarios y las fotos.

1. Entra a supabase.com, crea una cuenta y luego **New project**. Nombre: `rancho-las-lomas`. Región: la más cercana (por ejemplo `East US`). Guarda la contraseña de la base de datos en un lugar seguro.
2. Cuando el proyecto esté listo, ve a **SQL Editor → New query**. Abre en tu computadora el archivo `supabase/migrations/20261107000001_fase_a.sql`, copia todo su contenido, pégalo y presiona **Run**. Debe decir "Success".
3. Ve a **Authentication → Sign In / Providers** y activa **Allow anonymous sign-ins** (es lo que permite entrar a los invitados sin cuenta).
4. Ve a **Project Settings → API Keys** (o **Data API**) y copia:
   - **Project URL**
   - La llave **anon / publishable**
   - La llave **service_role / secret** (esta es secreta: solo va en tu computadora)
5. En la carpeta del proyecto, copia el archivo `.env.example` con el nombre `.env` y llena los valores:

```bash
cp .env.example .env
```

```bash
open -e .env
```

6. Date de alta como administrador (cambia correo y nombre):

```bash
npm run crear-usuario -- --correo tu@correo.com --nombre "Alonso Treviño" --rol admin --contrasena "UnaClaveSegura2026"
```

   Para el resto del personal, el mismo comando con `--rol staff` y sin `--contrasena`: la contraseña se genera y aparece en pantalla para que se la pases. Para quitarle el acceso a alguien: `npm run crear-usuario -- --correo juan@correo.com --desactivar`.

7. Carga el rancho de prueba (ficticio) para ver el mapa funcionando:

```bash
npm run cargar-prueba
```

**Sobre la seguridad:** cualquiera podría crear una cuenta vacía con correo en tu proyecto de Supabase, pero sin perfil no ve nada. Solo el comando `crear-usuario` (que usa la llave secreta) asigna roles.

---

## 3. Llave del mapa satelital (MapTiler)

1. Crea una cuenta gratuita en maptiler.com.
2. En **Account → API keys** copia tu llave y ponla en `.env` como `EXPO_PUBLIC_MAPTILER_KEY`.
3. En la misma pantalla, en **Allowed HTTP origins**, agrega `app.rancholaslomas.com.mx` para que nadie más pueda usar tu llave.

Sin esta llave la app usa las imágenes de Esri, que sirven para probar pero no para el uso diario del rancho (sus términos no lo cubren).

---

## 4. Ver la app en tu computadora

```bash
npx expo start --web
```

Se abre en el navegador con los datos de tu Supabase. Para verla como en el teléfono, en Chrome presiona `Cmd+Opción+I` y elige un iPhone en la barra superior.

---

## 5. Publicar en app.rancholaslomas.com.mx

La app se publica gratis en **Cloudflare Pages**, conectada a GitHub: cada cambio que se sube al repositorio se publica solo en uno o dos minutos.

### 5.1 Crear el sitio (una vez)

1. Crea una cuenta gratuita en dash.cloudflare.com.
2. Ve a **Workers & Pages → Create → Pages → Connect to Git**, autoriza GitHub y elige el repositorio `altrevino/appRanchoLasLomas`.
3. Configuración de compilación:
   - **Framework preset:** None
   - **Build command:** `npm run build:web`
   - **Build output directory:** `dist`
4. En **Environment variables** agrega (con tus valores):

| Nombre | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://TU-PROYECTO.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | tu llave anon / publishable |
| `EXPO_PUBLIC_MAPTILER_KEY` | tu llave de MapTiler |
| `EXPO_PUBLIC_APP_URL` | `https://app.rancholaslomas.com.mx` |

   La llave `service_role` **nunca** va aquí.
5. **Save and Deploy**. Al terminar te da una dirección tipo `rancho-las-lomas.pages.dev`; ábrela en el iPhone para confirmar que funciona.

### 5.2 Conectar el dominio

1. En el proyecto de Cloudflare Pages: **Custom domains → Set up a custom domain** → escribe `app.rancholaslomas.com.mx`.
2. Cloudflare te mostrará un registro **CNAME**: nombre `app`, destino `rancho-las-lomas.pages.dev` (o el que te indique).
3. Entra donde administras el dominio `rancholaslomas.com.mx` (el registrador, como Akky o GoDaddy, o el panel de tu hosting, en "Zona DNS" o "DNS") y agrega ese CNAME. **No toques los registros del sitio principal ni del correo.**
4. En minutos (a veces unas horas) Cloudflare marca el dominio como activo y genera el certificado HTTPS solo.

### 5.3 Compartirla

- **Personal:** mándales `https://app.rancholaslomas.com.mx`. Que la abran en **Safari**, entren con su correo y luego la agreguen a la pantalla de inicio: botón **Compartir → Agregar a pantalla de inicio**. Así abre a pantalla completa y funciona mejor sin señal. Las instrucciones también aparecen dentro de la app, en la pantalla de la cuenta.
- **Invitados:** genera un código en **Admin → Invitados y códigos** y muéstrales el QR. Lo escanean con la cámara del iPhone, se abre la app con el código ya escrito, ponen su nombre y entran. No instalan nada.

### 5.4 Sin señal

- La app se guarda en el teléfono la primera vez que se abre con señal. Después abre aunque no haya datos.
- El mapa muestra lindero, espiaderos, tu ubicación GPS y las imágenes satelitales **de las zonas que ya se vieron con señal**. Recomendación: antes de salir al campo, abrir el mapa con señal y acercarse a las zonas que se usarán.
- Si iPhone no usa la app en varias semanas puede borrar lo guardado; se recupera sola la próxima vez que haya señal.

---

## 6. Cargar el KML real del rancho

El KML debe tener: un **polígono** (lindero), **líneas** (caminos) y **puntos con nombre** (espiaderos). Sirve el que exporta Google Earth, en `.kml` o `.kmz`.

Qué hace la importación:

- Si un espiadero del KML **tiene el mismo nombre** que uno existente (sin importar mayúsculas ni acentos), se **actualiza su ubicación** y conserva todo su historial.
- Los espiaderos nuevos se crean.
- Los que ya no vienen en el KML (incluidos los 10 ficticios) se **archivan**: dejan de verse, pero no se borran.
- Lindero y caminos se reemplazan; los anteriores quedan archivados.
- Siempre ves una **vista previa** antes de guardar, con conteos y advertencias (puntos sin nombre, espiaderos a menos de 400 m, puntos fuera del lindero).

### Opción A: desde la app (recomendada)

1. Guarda el archivo en el iPhone (en Archivos o iCloud Drive; desde un correo: mantén presionado el adjunto → **Guardar en Archivos**). También funciona desde la computadora, abriendo la app en el navegador.
2. En la app: **Admin → Importar KML → Elegir archivo**.
3. Revisa los conteos y las advertencias. Si algo no cuadra, corrige el KML y vuelve a elegirlo.
4. Presiona **Guardar cambios**.

### Opción B: desde la computadora

1. Arrastra el archivo `.kml` o `.kmz` a la carpeta `kml/` del proyecto.
2. Vista previa (no cambia nada):

```bash
npm run importar-kml
```

3. Si todo está bien, aplica:

```bash
npm run importar-kml -- --aplicar
```

   Toma el archivo más reciente de la carpeta `kml/`. También puedes indicar uno: `npm run importar-kml -- ruta/archivo.kml --aplicar`.

### Verificar que quedó bien

1. En la app, pestaña **Mapa** → **Ver rancho**: el lindero arena debe coincidir con el rancho en la imagen satelital.
2. **Admin → Espiaderos**: deben aparecer los espiaderos reales y **ninguno con la marca "prueba"**.
3. Toca dos o tres espiaderos que conozcas y confirma que están en su lugar.
4. Si un espiadero quedó duplicado (por ejemplo, "La Noria" y "Noria"), es porque el nombre del KML no coincide con el anterior: corrige el nombre en el KML y vuelve a importar.

---

## 7. Comandos útiles

| Comando | Para qué |
|---|---|
| `npm run crear-usuario -- --correo X --nombre "N" --rol staff` | Alta de personal |
| `npm run importar-kml` | Vista previa del KML en `kml/` |
| `npm run importar-kml -- --aplicar` | Guardar el KML |
| `npm run cargar-prueba` | Cargar el rancho ficticio |
| `npm run probar-servidor` | Probar contra el Supabase real (admin temporal, código, invitado, permisos; limpia al final) |
| `npm test` | Pruebas del lector de KML y cálculos de distancia |
| `npm run test:db` | Pruebas de la base de datos (requiere Postgres con PostGIS local) |
| `npm run contraste` | Verificar contraste de colores (WCAG AA) |
| `npm run build:web` | Compilar la web app (lo hace Cloudflare solo) |
| `npm run logo` / `npm run iconos` | Regenerar trazos del logotipo / ícono y splash |

---

## 8. Estructura y decisiones técnicas

```
src/app/            Pantallas (Expo Router)
  acceso/           Inicio, invitado, personal
  (app)/            Pestañas: mapa, censo, bitacora, admin
src/components/     Componentes (consulta, mapa, logotipo)
src/lib/            Sesión, Supabase, KML, geografía, mapa
src/theme/          Tokens de diseño (colores, tipografía, espacios)
supabase/           Migraciones SQL y pruebas
scripts/            Línea de comandos (KML, usuarios, íconos)
kml/                Aquí se arrastra el KML real; kml/ejemplo/ trae el ficticio
```

- **Roles** en `perfiles.rol` (admin, staff, invitado). Toda la seguridad está en la base de datos (RLS): el invitado no puede leer tablas de personal aunque alguien modifique la app.
- **Invitados**: sesión anónima de Supabase + `canjear_codigo(código, nombre)`. El perfil vence cuando vence el código; revocar un código corta el acceso de todos los que entraron con él. Límite de 5 intentos fallidos por sesión y 50 en total cada 15 minutos.
- **Web app**: `public/sw.js` guarda la app completa y las imágenes satelitales ya vistas (hasta 4000 mosaicos). Las páginas se piden primero a la red, así cada publicación nueva llega en cuanto hay señal. `scripts/despues-de-exportar.cjs` lista los archivos y versiona el service worker en cada publicación.
- **Mapa sin señal**: los datos del mapa (lindero, caminos, espiaderos) y el perfil se guardan en el teléfono; la app abre con ellos y los actualiza en segundo plano.
- **Ortomosaico propio**: cuando lo tengas, se registra en la tabla `capas_base` (XYZ o PMTiles) y la app lo usa en lugar del satelital, sin cambiar código.
- **Pantallas de muestra** del diseño (`/muestras/ficha`, `/muestras/captura`) solo existen en desarrollo.

---

## 9. Opcional: app nativa de iPhone (TestFlight)

El mismo código compila como app nativa. Conviene si el personal necesita vibración en cada toque, brillo automático en el censo o avisos más confiables. Requiere cuenta de Apple Developer (99 USD al año) y una cuenta de Expo.

1. Inscríbete en developer.apple.com/programs (aprobación de horas a dos días).
2. `npx eas-cli@latest login` y `npx eas-cli@latest init`.
3. Carga las variables `EXPO_PUBLIC_*` con `npx eas-cli@latest env:create --environment production ...`.
4. `npx eas-cli@latest build --platform ios --profile production --auto-submit` y responde **Yes** a crear certificado, perfil y llave de notificaciones (APNs).
5. En App Store Connect → TestFlight: crea un grupo externo, agrega la compilación y activa el enlace público. La primera compilación pasa por revisión de Apple (menos de un día). Cada compilación vence a los 90 días.
