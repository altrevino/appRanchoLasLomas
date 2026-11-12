# Rancho Las Lomas

App interna del Rancho Las Lomas: mapa del rancho con espiaderos, censo simultáneo de venado cola blanca, bitácora de machos y medidor de distancias.

Es una **web app**: se abre en **https://app.rancholaslomas.com.mx** desde el iPhone, sin instalar nada. El personal puede agregarla a la pantalla de inicio para usarla como app. Hecha con Expo (React Native para web) y Supabase; el mismo código puede compilarse como app nativa de iPhone más adelante (sección 13).

| Fase | Contenido | Estado |
|---|---|---|
| a | Proyecto base, tema, acceso con código de invitado, importador de KML, mapa con datos de prueba | Lista |
| b | Censo simultáneo con avisos (push) y tiempo real | Lista |
| c | Bitácora de machos | Lista |
| d | Distancias | Lista |

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

La app vive en **Cloudflare Workers** (proyecto `apprancholaslomas`, cuenta de Cloudflare del rancho), conectado al repositorio de GitHub. **Cada cambio que se sube a la rama `main` se compila y publica solo** en uno o dos minutos. No hay que hacer nada más.

- La configuración está en el código: `wrangler.jsonc` (archivos, rutas y dominio) y `.env.production` (dirección de Supabase y llave pública; no contiene secretos).
- El dominio `app.rancholaslomas.com.mx` lo crea Cloudflare automáticamente al publicar (registro DNS `app`). Los demás registros del dominio (sitio, correo, Home Assistant) no se tocan.
- Para ver publicaciones o errores de compilación: dash.cloudflare.com → **Workers & Pages → apprancholaslomas → Deployments**.
- Para agregar la llave de MapTiler: ponla en `.env.production` como `EXPO_PUBLIC_MAPTILER_KEY=...` y sube el cambio.

### 5.3 Compartirla

- **Personal:** mándales `https://app.rancholaslomas.com.mx`. Que la abran en **Safari**, entren con su correo y luego la agreguen a la pantalla de inicio: botón **Compartir → Agregar a pantalla de inicio**. Así abre a pantalla completa y funciona mejor sin señal. Las instrucciones también aparecen dentro de la app, en la pantalla de la cuenta.
- **Invitados:** genera un código en **Admin → Invitados y códigos** y muéstrales el QR. Lo escanean con la cámara del iPhone, se abre la app con el código ya escrito, ponen su nombre y entran. No instalan nada.

### 5.4 Sin señal

- La app se guarda en el teléfono la primera vez que se abre con señal. Después abre aunque no haya datos.
- El mapa muestra lindero, espiaderos, tu ubicación GPS y las imágenes satelitales **de las zonas que ya se vieron con señal**. Recomendación: antes de salir al campo, abrir el mapa con señal y acercarse a las zonas que se usarán.
- Si iPhone no usa la app en varias semanas puede borrar lo guardado; se recupera sola la próxima vez que haya señal.

---

## 6. Censo simultáneo

### Antes del primer censo (cada persona, una vez)

1. Abrir `app.rancholaslomas.com.mx` en **Safari** y agregarla a la pantalla de inicio (**Compartir → Agregar a pantalla de inicio**).
2. Abrirla desde el ícono, ir a **Censo** y tocar **Activar avisos**. Así le llega el aviso cuando inicies un censo.

Los invitados no necesitan avisos: basta con que tengan la app abierta (en cualquier pantalla) cuando inicies; entran solos a la captura.

### Hacer un censo (administrador)

1. **Censo → Nuevo censo**: nombre, duración (20 min por omisión), espiaderos participantes (todos marcados; toca para quitar) y, si quieres, quién va en cada uno (**Asignar**).
2. **Iniciar ahora**. El servidor fija la hora de inicio y fin para todos y se manda el aviso. También puedes **Guardar para después** e iniciarlo desde **Preparados**.
3. Se abre el **conteo en vivo**: totales por clase y por espiadero, quién está en cada uno y hace cuánto fue su último registro. **Terminar ahora** cierra antes de tiempo.
4. Al terminar queda el resumen en **Censos anteriores**.

### Captura (todos)

- La app elige el espiadero por GPS (el que te contenga en su radio). Si no estás en ninguno, eliges de la lista; siempre se puede **Cambiar espiadero**.
- Cada toque en M1–M4, Hembra o Cría es un registro. **Deshacer último** quita el último.
- Sin señal se sigue capturando: arriba aparece «N por enviar» y se envían solos al volver la señal. Se aceptan si su hora quedó dentro del censo.
- En iPhone con la web app no hay vibración al tocar (Safari no lo permite): el botón se ilumina. **No se usa sonido** para no espantar a los animales.
- Invitados: ven sus propios conteos; al cerrar, los totales por clase. El desglose por espiadero solo lo ve el personal.

### Probar sin ir al rancho (simulación)

```bash
npm run simular -- --usuarios 8 --minutos 5
```

Crea 8 usuarios temporales, inicia un censo marcado como «simulación» y los pone a contar en tiempo real (algunos «sin señal» que envían tarde). Abre en la app **Censo → Ver conteo en vivo** para verlo. Al final cierra el censo y borra los usuarios temporales. También puedes iniciar un censo desde la app y pasar su id: `npm run simular -- --censo <id>`.

---

## 7. Bitácora de machos (administrador y personal)

Los invitados no ven la bitácora ni los avistamientos en el mapa.

### Registrar un avistamiento

1. **Bitácora → Registrar avistamiento** (o, desde la ficha de un ejemplar, **Registrar avistamiento** para ese ejemplar).
2. **Foto**: tomarla o elegirla de la galería (opcional). Se comprime en el teléfono antes de subirla.
3. **Lugar**: el espiadero se detecta por GPS; **Cambiar** para elegir otro o «Fuera de espiadero».
4. **Clase** (M1–M4) y **rasgos**: puntas por lado, forma de la cornamenta, cuerno roto, puntas anómalas, oreja marcada, cicatrices y una nota. Todo es opcional salvo la clase; «No sé» deja el dato vacío.
5. **Buscar parecidos**: la app muestra los ejemplares más parecidos (misma clase o vecina, rasgos que coinciden, mismo espiadero o cercano, visto recientemente) con su foto y el porcentaje de parecido.
   - **Es este** → se suma al ejemplar.
   - **Es un ejemplar nuevo** → se crea con folio automático (LL-001, LL-002…) y queda **por validar**.
6. Sin señal se guarda en el teléfono (con su foto) y se envía solo al volver la señal.

### Fichas

Foto principal, folio, clase y apodo; galería; rasgos; espiaderos donde se ha visto; historial de avistamientos y cambios de clase. El personal puede **Editar** (apodo, clase, rasgos, nota) y elegir la foto principal. El administrador además puede **Validar ejemplar**, **Unir con otro ejemplar** (duplicados: avistamientos y fotos pasan al que se conserva) y **Marcar como cazado**. Los ejemplares activos sin avistamientos en 60 días aparecen como «Sin ver 60 días».

En el **Mapa**, al tocar un espiadero, el personal ve los últimos avistamientos de ese lugar.

---

## 8. Distancias

En el **Mapa**, toca un espiadero, la Casa, un avistamiento (personal: botón **Ver avistamientos**, últimos 30 días) o cualquier punto. Se dibuja una línea desde tu ubicación y se muestra:

- **Distancia** en línea recta.
- **Rumbo** en grados y punto cardinal (0° = norte, 90° = este).
- **Diferencia de altura** del terreno («18 m más alto que tú»). Se calcula con un modelo de elevación del terreno (Copernicus, ~90 m de detalle) para los dos puntos, porque la altitud del GPS del teléfono tiene un error de 10–20 m. Sin señal, la distancia y el rumbo siguen funcionando; la altura no.

Todo se actualiza al moverte. Cierra con **×**.

---

## 9. Personal del rancho (administrador)

**Admin → Personal**:

- **Agregar**: nombre, correo y rol (Personal o Administrador). La app muestra la contraseña temporal; **Copiar para enviar por mensaje** arma el texto con la dirección, el correo y la contraseña. Cada quien puede cambiarla tocando su nombre arriba a la derecha.
- **Nueva contraseña** si alguien la olvida.
- **Hacer administrador / Hacer personal**.
- **Desactivar** (deja de poder entrar; sus registros se conservan) y **Reactivar**.

No puedes cambiar tu propio rol ni desactivarte (para no quedarte sin acceso). Los invitados no van aquí: entran con código.

---

## 10. Cargar el KML real del rancho

El KML debe tener: un **polígono** (lindero), **líneas** (caminos) y **puntos con nombre** (espiaderos). Sirve el que exporta Google Earth, en `.kml` o `.kmz`.

Qué hace la importación:

- Si un espiadero del KML **tiene el mismo nombre** que uno existente (sin importar mayúsculas ni acentos), se **actualiza su ubicación** y conserva todo su historial.
- Los espiaderos nuevos se crean.
- Los que ya no vienen en el KML (incluidos los 10 ficticios) se **archivan**: dejan de verse, pero no se borran.
- Lindero y caminos se reemplazan; los anteriores quedan archivados.
- Un punto llamado **Casa** se carga como **lugar** (se ve en el mapa con una casita y sirve para medir distancias), no como espiadero. Para cargar otro punto como lugar desde la computadora: `npm run importar-kml -- --lugar "Bodega" --aplicar`.
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

## 11. Comandos útiles

| Comando | Para qué |
|---|---|
| `npm run crear-usuario -- --correo X --nombre "N" --rol staff` | Alta de personal |
| `npm run importar-kml` | Vista previa del KML en `kml/` |
| `npm run importar-kml -- --aplicar` | Guardar el KML |
| `npm run cargar-prueba` | Cargar el rancho ficticio |
| `npm run simular -- --usuarios 8 --minutos 5` | Censo de prueba con usuarios falsos |
| `npm run probar-servidor` | Probar contra el Supabase real (admin temporal, código, invitado, permisos; limpia al final) |
| `npm test` | Pruebas del lector de KML y cálculos de distancia |
| `npm run test:db` | Pruebas de la base de datos (requiere Postgres con PostGIS local) |
| `npm run contraste` | Verificar contraste de colores (WCAG AA) |
| `npm run build` | Compilar la web app (lo hace Cloudflare solo con cada push) |
| `npm run logo` / `npm run iconos` | Regenerar trazos del logotipo / ícono y splash |

---

## 12. Estructura y decisiones técnicas

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
- **Censo**: `registrar_lote` recibe la cola del teléfono (ids generados en el teléfono, sin duplicados) y valida la ventana del servidor; `censo_actual` y `resumen_censo` alimentan la captura y el monitor; Supabase Realtime avisa de inicio/fin y de cada registro. Avisos por Web Push con la función `supabase/functions/avisar-censo` (llaves VAPID guardadas como secretos en Supabase).
- **Clases**: M1 1.5 · M2 2.5 · M3 3.5 · M4 4.5 · M5 5.5+ años (`src/config/textos.ts`).
- **Personal**: la función `supabase/functions/admin-usuarios` crea cuentas, cambia rol y contraseña y desactiva (necesita la llave secreta, por eso vive en el servidor). Solo responde a administradores.
- **Bitácora**: el teléfono genera los ids (ejemplar, avistamiento, foto) para guardar sin señal; `registrar_avistamiento` crea el ejemplar si es nuevo, sin duplicar en reintentos, y redirige al destino si el ejemplar se fusionó mientras tanto. La búsqueda de parecidos corre en el teléfono (`src/lib/bitacora/similitud.ts`, con pruebas). Fotos en la carpeta privada `fotos` de Supabase Storage, visibles solo para el personal mediante enlaces firmados de una hora.

---

## 13. Opcional: app nativa de iPhone (TestFlight)

El mismo código compila como app nativa. Conviene si el personal necesita vibración en cada toque, brillo automático en el censo o avisos más confiables. Requiere cuenta de Apple Developer (99 USD al año) y una cuenta de Expo.

1. Inscríbete en developer.apple.com/programs (aprobación de horas a dos días).
2. `npx eas-cli@latest login` y `npx eas-cli@latest init`.
3. Carga las variables `EXPO_PUBLIC_*` con `npx eas-cli@latest env:create --environment production ...`.
4. `npx eas-cli@latest build --platform ios --profile production --auto-submit` y responde **Yes** a crear certificado, perfil y llave de notificaciones (APNs).
5. En App Store Connect → TestFlight: crea un grupo externo, agrega la compilación y activa el enlace público. La primera compilación pasa por revisión de Apple (menos de un día). Cada compilación vence a los 90 días.
