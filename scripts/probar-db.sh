#!/usr/bin/env bash
# Corre las migraciones y las pruebas SQL en un Postgres local con PostGIS.
# Requiere: psql y un servidor con PostGIS. Variables: PGHOST, PGPORT, PGUSER.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=rancho_pruebas
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -d $DB -v ON_ERROR_STOP=1 -f supabase/tests/stub-supabase.sql >/dev/null
for m in supabase/migrations/*.sql; do psql -q -d $DB -v ON_ERROR_STOP=1 -f "$m" >/dev/null; done
DATOS=$(npx tsx scripts/importar-kml.mts kml/ejemplo/rancho-prueba.kml --json)
VISTA='{"linderos":[{"nombre":"Lindero real","coordenadas":[[[-100.12,26.60],[-100.05,26.60],[-100.05,26.65],[-100.12,26.65],[-100.12,26.60]]]}],"caminos":[{"nombre":"Camino real","coordenadas":[[-100.11,26.61],[-100.06,26.64]]}],"espiaderos":[{"nombre":"LA NORIA","lon":-100.1095,"lat":26.6132,"altitud":null},{"nombre":"El Ebano","lon":-100.065,"lat":26.614,"altitud":335},{"nombre":"El Venadito","lon":-100.08,"lat":26.63,"altitud":null}]}'
psql -tA -d $DB -v datos="$DATOS" -v vista_datos="$VISTA" -f supabase/tests/fase_a.test.sql 2>&1 | grep -v -e "^$" -e "_kml_esp" | sed "s/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  //"
psql -tA -d $DB -f supabase/tests/fase_b.test.sql 2>&1 | grep -v -e "^$" -e "_kml_esp" | sed "s/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  //"
