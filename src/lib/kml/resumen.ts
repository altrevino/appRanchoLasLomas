/** Respuesta de la función `importar_kml` de la base de datos. */
export interface ResumenImportacion {
  espiaderos: {
    actualizar: { id: string; nombre: string; nombre_anterior: string; movido_m: number }[];
    crear: string[];
    archivar: { id: string; nombre: string; origen: string }[];
  };
  linderos: { nuevos: number; archivar: number };
  caminos: { nuevos: number; archivar: number };
  lugares?: { nuevos: number; nombres: string[]; archivar: number };
  aplicado: boolean;
}

/** Texto plano del resumen (script de línea de comandos). */
export function formatearResumen(r: ResumenImportacion): string {
  const l: string[] = [r.aplicado ? 'Cambios aplicados:' : 'Cambios que se harán:'];
  const e = r.espiaderos;
  l.push(`  Espiaderos que se actualizan (conservan historial): ${e.actualizar.length}`);
  e.actualizar.forEach((x) => l.push(`    · ${x.nombre}${x.movido_m ? ` (se mueve ${x.movido_m} m)` : ''}`));
  l.push(`  Espiaderos nuevos: ${e.crear.length}`);
  e.crear.forEach((n) => l.push(`    · ${n}`));
  l.push(`  Espiaderos que se archivan: ${e.archivar.length}`);
  e.archivar.forEach((x) => l.push(`    · ${x.nombre}${x.origen === 'prueba' ? ' (de prueba)' : ''}`));
  l.push(`  Lindero: ${r.linderos.nuevos} nuevo(s), ${r.linderos.archivar} anterior(es) se archivan`);
  l.push(`  Caminos: ${r.caminos.nuevos} nuevo(s), ${r.caminos.archivar} anterior(es) se archivan`);
  if (r.lugares) l.push(`  Lugares (no son espiaderos): ${r.lugares.nombres.join(', ') || 'ninguno'}`);
  return l.join('\n');
}
