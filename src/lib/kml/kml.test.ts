import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { hayErrores, leerArchivoKml, leerKml } from './index';

const prueba = readFileSync('kml/ejemplo/rancho-prueba.kml', 'utf8');

test('detecta lindero, caminos y espiaderos del KML de prueba', () => {
  const r = leerKml(prueba);
  assert.equal(r.datos.linderos.length, 1);
  assert.equal(r.datos.caminos.length, 4);
  assert.equal(r.datos.espiaderos.length, 10);
  assert.ok(r.datos.espiaderos.some((e) => e.nombre === 'El Ébano'), 'conserva acentos del nombre');
  assert.equal(r.datos.espiaderos[0].altitud, 312);
  assert.equal(hayErrores(r), false);
  assert.deepEqual(r.advertencias, []);
});

test('lee KMZ', () => {
  const kmz = zipSync({ 'doc.kml': strToU8(prueba) });
  assert.equal(leerArchivoKml(kmz).datos.espiaderos.length, 10);
});

const envolver = (placemarks: string) =>
  `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${placemarks}</Document></kml>`;
const lindero = `<Placemark><name>L</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
  -100.12,26.60 -100.05,26.60 -100.05,26.65 -100.12,26.65 -100.12,26.60</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
const punto = (n: string, lon: number, lat: number) =>
  `<Placemark>${n ? `<name>${n}</name>` : ''}<Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`;

test('advierte puntos sin nombre, cercanos y fuera del lindero', () => {
  const r = leerKml(
    envolver(lindero + punto('', -100.1, 26.62) + punto('A', -100.09, 26.62) + punto('B', -100.0885, 26.62) + punto('Lejos', -99.9, 26.62)),
  );
  const textos = r.advertencias.map((a) => a.mensaje).join('\n');
  assert.match(textos, /1 punto\(s\) sin nombre/);
  assert.match(textos, /"A" y "B" están a \d+ m/);
  assert.match(textos, /Fuera del lindero: "Lejos"/);
  assert.equal(r.datos.espiaderos[0].nombre, 'Espiadero sin nombre 1');
  assert.equal(r.datos.espiaderos[0].altitud, null, 'altitud 0 = sin dato');
  assert.equal(hayErrores(r), false);
});

test('nombres repetidos (sin importar acentos) son error', () => {
  const r = leerKml(envolver(lindero + punto('La Noria', -100.1, 26.62) + punto('la noría', -100.07, 26.63)));
  assert.equal(hayErrores(r), true);
});

test('sin lindero es error', () => {
  assert.equal(hayErrores(leerKml(envolver(punto('A', -100.1, 26.62)))), true);
});

test('rechaza archivos que no son KML', () => {
  assert.throws(() => leerKml('<html></html>'), /no parece ser un KML/);
});
