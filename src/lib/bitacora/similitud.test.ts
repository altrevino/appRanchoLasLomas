import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidatos, puntuar, type Observacion } from './similitud';
import { rasgosVacios, type Macho } from './tipos';

const ahora = Date.parse('2026-11-13T12:00:00Z');
const base = (p: Partial<Macho>): Macho => ({
  ...rasgosVacios(),
  id: p.folio ?? 'x',
  folio: 'LL-000',
  apodo: null,
  clase_actual: 'M3',
  estado: 'activo',
  estado_efectivo: 'activo',
  nota: null,
  foto_portada_id: null,
  portada_path: null,
  primer_avistamiento_at: null,
  ultimo_avistamiento_at: '2026-11-01T12:00:00Z',
  ultimo_espiadero_id: 'petrolera',
  ultimo_espiadero_nombre: 'Petrolera',
  ultimo_lon: -100.0697,
  ultimo_lat: 27.0665,
  num_avistamientos: 3,
  creado_at: '2026-01-01T00:00:00Z',
  ...p,
});
const obs = (p: Partial<Observacion>): Observacion => ({
  ...rasgosVacios(),
  clase: 'M3',
  espiadero_id: 'petrolera',
  lon: -100.0697,
  lat: 27.0665,
  cuando: ahora,
  ...p,
});

test('el ejemplar con rasgos raros coincidentes queda primero', () => {
  const chueco = base({ folio: 'LL-001', cuerno_roto: 'derecho', puntas_izq: 5, puntas_der: 4 });
  const otro = base({ folio: 'LL-002', cuerno_roto: 'no', puntas_izq: 4, puntas_der: 4 });
  const lejano = base({ folio: 'LL-003', clase_actual: 'M1', ultimo_espiadero_id: 'taza', ultimo_lon: -100.0793, ultimo_lat: 27.0509, ultimo_avistamiento_at: '2025-01-01T00:00:00Z' });
  const r = candidatos([otro, lejano, chueco], obs({ cuerno_roto: 'derecho', puntas_izq: 5, puntas_der: 4 }));
  assert.equal(r[0].macho.folio, 'LL-001');
  assert.ok(r[0].motivos.includes('Cuerno roto derecho'));
  assert.ok(r[0].parecido > 80, `parecido ${r[0].parecido}`);
  assert.ok(!r.some((c) => c.macho.folio === 'LL-003'), 'el M1 lejano y viejo no aparece');
});

test('clase vecina cuenta (un M2 que ya es M3)', () => {
  const c = puntuar(base({ clase_actual: 'M2' }), obs({ clase: 'M3' }));
  assert.ok(c.motivos.includes('Clase vecina'));
});

test('discrepancia en rasgo raro resta', () => {
  const coincide = puntuar(base({ oreja_marcada: true }), obs({ oreja_marcada: true }));
  const contradice = puntuar(base({ oreja_marcada: true }), obs({ oreja_marcada: false }));
  assert.ok(coincide.puntos > contradice.puntos + 10);
});

test('excluye cazados y fusionados', () => {
  const r = candidatos([base({ folio: 'A', estado: 'cazado' }), base({ folio: 'B', estado: 'fusionado' }), base({ folio: 'C' })], obs({}));
  assert.deepEqual(r.map((c) => c.macho.folio), ['C']);
});

test('sin rasgos conocidos, decide por clase, lugar y fecha', () => {
  const r = candidatos([base({ folio: 'cerca' }), base({ folio: 'lejos', ultimo_espiadero_id: 'taza', ultimo_lon: -100.0793, ultimo_lat: 27.0509 })], obs({}));
  assert.equal(r[0].macho.folio, 'cerca');
});
