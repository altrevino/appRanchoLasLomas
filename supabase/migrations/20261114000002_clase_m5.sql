-- Clase M5 (5.5 años o más). Va sola: un valor nuevo de enum no puede usarse
-- en la misma transacción en que se agrega.
alter type public.clase_censo add value if not exists 'M5' after 'M4';
