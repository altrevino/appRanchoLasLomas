# Rancho Las Lomas

App interna para iPhone del Rancho Las Lomas: mapa del rancho con espiaderos, censo simultáneo de venado cola blanca, bitácora de machos y medidor de distancias.

Hecha con Expo (React Native) y Supabase. Se distribuye por TestFlight.

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
3. En la misma página, en **Allowed HTTP origins / bundle IDs**, puedes restringirla a `mx.rancholaslomas.app`.

Sin esta llave la app usa las imágenes de Esri, que sirven para probar pero no para el uso diario del rancho (sus términos no lo cubren).

---

## 4. Ver la app en tu computadora (vista previa)

```bash
npx expo start --web
```

Se abre en el navegador. Sirve para revisar pantallas y flujos. El mapa del navegador es una versión aproximada: la definitiva (MapLibre nativo, caché de mapa sin señal, GPS real) solo corre en el iPhone.

---

## 5. Publicar en iPhone con TestFlight

### 5.1 Cuenta de Apple Developer (una vez, cuesta 99 USD al año)

1. Entra a developer.apple.com/programs con tu Apple ID y presiona **Enroll**.
2. Elige **Individual** (a tu nombre) u **Organization** (a nombre de una empresa; pide un número D-U-N-S, que es gratuito pero tarda días).
3. Paga. La aprobación tarda de unas horas a dos días. Llega un correo de confirmación.

### 5.2 Cuenta de Expo (gratuita)

1. Crea una cuenta en expo.dev.
2. En la Terminal:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

   El segundo comando liga el proyecto a tu cuenta de Expo (agrega un `projectId` a `app.json`; guarda ese cambio en git).

### 5.3 Variables de la app en Expo

La app compilada necesita las llaves públicas. Cárgalas una vez (usa tus valores):

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "https://TU-PROYECTO.supabase.co" --visibility plaintext
```

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "TU-LLAVE-ANON" --visibility plaintext
```

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_MAPTILER_KEY --value "TU-LLAVE-MAPTILER" --visibility plaintext
```

La llave `service_role` **nunca** se carga aquí.

### 5.4 Compilar y subir a TestFlight

```bash
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

La primera vez te hará varias preguntas. Responde así:

- Inicia sesión con tu Apple ID (el de Apple Developer).
- "Generate a new Apple Distribution Certificate?" → **Yes**
- "Generate a new Apple Provisioning Profile?" → **Yes**
- "Generate a new Apple Push Notifications service key?" → **Yes** (esto es APNs: lo que permite mandar avisos de inicio de censo en la fase b; Expo guarda la llave por ti)
- Si pregunta por el app en App Store Connect, deja que la cree con el nombre **Las Lomas** y el identificador `mx.rancholaslomas.app`.

La compilación tarda de 15 a 30 minutos en los servidores de Expo. Al terminar se sube sola a App Store Connect. Apple la procesa en 10 a 30 minutos más.

### 5.5 Dar acceso por enlace público

1. Entra a appstoreconnect.apple.com → **Apps → Las Lomas → TestFlight**.
2. En **Información de prueba** llena el correo de contacto y una descripción breve ("App interna del rancho").
3. En **Pruebas externas** crea un grupo (por ejemplo "Rancho") y agrega la compilación.
4. La primera compilación pasa por una revisión de Apple (normalmente menos de un día). Si piden credenciales de prueba, dales un código de invitado vigente.
5. Activa **Habilitar enlace público**. Ese enlace es el que mandas a personal e invitados: lo abren en el iPhone, instalan TestFlight y luego la app.

Para cada versión nueva repite el paso 5.4. Las compilaciones después de la primera normalmente no necesitan revisión.

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

1. Guarda el archivo en el iPhone (en Archivos o iCloud Drive; desde un correo: mantén presionado el adjunto → **Guardar en Archivos**).
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
| `npm test` | Pruebas del lector de KML y cálculos de distancia |
| `npm run test:db` | Pruebas de la base de datos (requiere Postgres con PostGIS local) |
| `npm run contraste` | Verificar contraste de colores (WCAG AA) |
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
- **Mapa sin señal**: los datos del mapa (lindero, caminos, espiaderos) se guardan en el teléfono; MapLibre guarda en caché las imágenes ya vistas; el GPS funciona sin datos.
- **Ortomosaico propio**: cuando lo tengas, se registra en la tabla `capas_base` (XYZ o PMTiles) y la app lo usa en lugar del satelital, sin cambiar código.
- **Pantallas de muestra** del diseño (`/muestras/ficha`, `/muestras/captura`) solo existen en desarrollo.
