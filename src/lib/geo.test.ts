import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanciaM, espiaderoEnRadio, puntoCardinal, rumboGrados } from './geo';

test('distancia y rumbo', () => {
  // 0.01° de latitud ≈ 1112 m
  const d = distanciaM([-100.1, 26.6], [-100.1, 26.61]);
  assert.ok(Math.abs(d - 1112) < 3, `distancia ${d}`);
  assert.ok(Math.abs(rumboGrados([-100.1, 26.6], [-100.1, 26.61])) < 0.01);
  assert.equal(puntoCardinal(rumboGrados([-100.1, 26.6], [-100.09, 26.6])), 'E');
  assert.equal(puntoCardinal(225), 'SO');
  assert.equal(puntoCardinal(350), 'N');
});

test('espiadero en radio elige el más cercano', () => {
  const es = [
    { id: 'a', lon: -100.1, lat: 26.6, radio_m: 200 },
    { id: 'b', lon: -100.0985, lat: 26.6, radio_m: 200 },
  ];
  assert.equal(espiaderoEnRadio([-100.0988, 26.6], es)?.id, 'b');
  assert.equal(espiaderoEnRadio([-100.05, 26.6], es), null);
});
