# Rancho Las Lomas

App interna (iPhone, Expo + Supabase) para el mapa del rancho, censo simultáneo de venado cola blanca, bitácora de machos y distancias.

## Estado actual: aprobación de diseño

- Tema: `src/theme/tokens.ts` (tokens) y `src/theme/index.ts` (modos consulta y campo).
- Contraste WCAG AA de todos los pares texto/fondo: `npm run contraste`.
- Pantallas de muestra: `src/app/muestras/ficha.tsx` (consulta) y `src/app/muestras/captura.tsx` (campo).
- Capturas de pantalla: `docs/muestras/`.
- Logotipo oficial: `assets/logo/logo-completo.svg`. Si cambia, correr `npm run logo` (trazos para la app) y `npm run iconos` (ícono, splash, favicon).

## Correr en local

```bash
npm install
npx expo start --web     # vista previa en navegador
```

Las instrucciones completas (Apple Developer, APNs, EAS, TestFlight, carga del KML real) se agregan al cerrar cada fase.
