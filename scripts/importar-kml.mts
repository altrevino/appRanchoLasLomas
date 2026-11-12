/// <reference types="node" />
/**
 * Importa el KML del rancho (lindero, caminos y espiaderos) a Supabase.
 *
 * Uso:
 *   npm run importar-kml                    # toma el .kml/.kmz más reciente de la carpeta kml/
 *   npm run importar-kml -- ruta/archivo.kml
 *   npm run importar-kml -- --aplicar       # sin --aplicar solo muestra la vista previa
 *   npm run importar-kml -- archivo.kml --json   # imprime lo detectado, sin conectarse
 *   npm run cargar-prueba                   # carga el rancho ficticio (marcado como prueba)
 *   npm run importar-kml -- --excluir "X"      # ignora ese punto (repetible)
 *   npm run importar-kml -- --lugar "Bodega"   # carga ese punto como lugar, no espiadero (repetible)
 *   (un punto llamado "Casa" siempre se carga como lugar)
 *
 * Requiere en .env: EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { hayErrores, leerArchivoKml } from '../src/lib/kml';
import { formatearResumen, type ResumenImportacion } from '../src/lib/kml/resumen';

const args = process.argv.slice(2);
const aplicar = args.includes('--aplicar');
const soloJson = args.includes('--json');
const esPrueba = args.includes('--prueba');
const excluir = args.flatMap((a, i) => (a === '--excluir' && args[i + 1] ? [args[i + 1].trim().toLowerCase()] : []));
const lugaresExtra = args.flatMap((a, i) => (a === '--lugar' && args[i + 1] ? [args[i + 1]] : []));
let ruta = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--excluir' && args[i - 1] !== '--lugar');

if (!ruta) {
  const carpeta = 'kml';
  const candidatos = existsSync(carpeta)
    ? readdirSync(carpeta)
        .filter((f) => /\.km[lz]$/i.test(f))
        .map((f) => join(carpeta, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    : [];
  if (!candidatos.length) {
    console.error('No hay ningún .kml o .kmz en la carpeta kml/. Copia ahí el archivo del rancho y vuelve a correr.');
    process.exit(1);
  }
  ruta = candidatos[0];
}

const lectura = leerArchivoKml(new Uint8Array(readFileSync(ruta)), lugaresExtra);
if (excluir.length) {
  const antes = lectura.datos.espiaderos.length;
  lectura.datos.espiaderos = lectura.datos.espiaderos.filter((e) => !excluir.includes(e.nombre.trim().toLowerCase()));
  console.log(`Excluidos como espiadero: ${antes - lectura.datos.espiaderos.length} (${excluir.join(', ')})`);
}

if (soloJson) {
  process.stdout.write(JSON.stringify(lectura.datos));
  process.exit(0);
}

console.log(`\nArchivo: ${ruta}`);
console.log(`Detectado: ${lectura.datos.linderos.length} lindero(s), ${lectura.datos.caminos.length} camino(s), ${lectura.datos.espiaderos.length} espiadero(s), ${lectura.datos.lugares.length} lugar(es)`);
for (const l of lectura.datos.lugares) console.log(`  · Lugar: ${l.nombre}`);
for (const e of lectura.datos.espiaderos) {
  console.log(`  · ${e.nombre}  (${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}${e.altitud != null ? `, ${e.altitud} m` : ''})`);
}
if (lectura.advertencias.length) {
  console.log('\nAdvertencias:');
  for (const a of lectura.advertencias) console.log(`  ${a.gravedad === 'error' ? 'ERROR' : 'Aviso'}: ${a.mensaje}`);
}
if (hayErrores(lectura)) {
  console.error('\nHay errores. Corrige el KML y vuelve a intentar. No se importó nada.');
  process.exit(1);
}

try {
  process.loadEnvFile('.env');
} catch {
  // sin .env: se usan las variables del entorno
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !llave) {
  console.error('\nFaltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env');
  process.exit(1);
}
const supabase = createClient(url, llave, { auth: { persistSession: false } });

const { data, error } = await supabase.rpc('importar_kml', {
  p_datos: esPrueba ? { ...lectura.datos, origen: 'prueba' } : lectura.datos,
  p_aplicar: aplicar,
  p_archivo: basename(ruta),
});
if (error) {
  console.error(`\nLa base de datos rechazó la importación: ${error.message}`);
  process.exit(1);
}

console.log('\n' + formatearResumen(data as ResumenImportacion));
if (!aplicar) {
  console.log('\nEsto fue solo una vista previa. Para guardar los cambios:\n  npm run importar-kml -- --aplicar\n');
} else {
  console.log('\nListo. Abre el mapa en la app para verificar.\n');
}
