import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aCaptura, calcular, deCaptura, formato, type Medidas } from './calculo';

const par = (d: number | null, i: number | null) => ({ d, i });
// Ejemplo resuelto a mano (octavos)
const m: Medidas = {
  viga: par(194, 190),
  g: [par(40, 38), par(80, 76), par(64, 66), par(16, null), par(null, null)],
  h: [par(40, 40), par(36, 36), par(36, 34), par(32, 32)],
  ap: [par(24, null), par(null, null), par(null, null)],
};

test('puntuación B&C completa', () => {
  const r = calcular(148, m);
  assert.equal(r.creditoAbertura, 148);
  assert.equal(r.sumaDer, 562); // 538 típicas + 24 anormal
  assert.equal(r.sumaIzq, 512);
  assert.equal(r.bruta, 1222);
  assert.equal(formato(r.bruta), '152 6/8');
  assert.equal(r.diferencias, 30);
  assert.equal(r.anormales, 24);
  assert.equal(formato(r.netaTipica), '143');
  assert.equal(formato(r.netaNoTipica), '149');
  assert.equal(r.puntasDer, 6);
  assert.equal(r.puntasIzq, 4);
});

test('el crédito de abertura no excede la viga más larga', () => {
  assert.equal(calcular(200, m).creditoAbertura, 194);
});

test('formato y captura en octavos', () => {
  assert.equal(formato(3), '3/8');
  assert.equal(formato(144), '18');
  assert.equal(formato(null), '');
  assert.equal(deCaptura({ p: '18', o: '4' }), 148);
  assert.equal(deCaptura({ p: '18', o: '' }), 144);
  assert.equal(deCaptura({ p: '', o: '' }), null);
  assert.equal(deCaptura({ p: '18', o: '8' }), 'invalido');
  assert.equal(deCaptura({ p: '1.5', o: '' }), 'invalido');
  assert.deepEqual(aCaptura(148), { p: '18', o: '4' });
  assert.deepEqual(aCaptura(144), { p: '18', o: '' });
});
