-- ============================================================
-- Sub-areas: a city can belong to a parent destination.
--
-- The hotel DB files Seminyak/Ubud/Kuta hotels under city "Bali", but
-- agents sell by area ("2N Kuta + 2N Seminyak"). parent_city_id links
-- an area to its umbrella destination so hotel search for an area also
-- covers the parent's hotels. Seeded for Bali; extend the array (or set
-- parent_city_id manually) for any future coarse-grained destination.
-- ============================================================

ALTER TABLE geo_cities ADD COLUMN IF NOT EXISTS parent_city_id bigint REFERENCES geo_cities(id);
CREATE INDEX IF NOT EXISTS geo_cities_parent_idx ON geo_cities (parent_city_id);

DO $$
DECLARE
  bali_id bigint;
  area text;
BEGIN
  SELECT id INTO bali_id FROM geo_cities WHERE country_code = 'ID' AND lower(name) = 'bali' LIMIT 1;
  IF bali_id IS NULL THEN RETURN; END IF;

  FOREACH area IN ARRAY ARRAY[
    'Seminyak','Kuta','Legian','Canggu','Ubud','Nusa Dua','Jimbaran',
    'Sanur','Uluwatu','Amed','Lovina','Candidasa','Sidemen','Pecatu',
    'Tanjung Benoa','Denpasar'
  ] LOOP
    INSERT INTO geo_cities (country_code, name, source, parent_city_id)
    VALUES ('ID', area, 'import', bali_id)
    ON CONFLICT (country_code, name) DO UPDATE SET parent_city_id = EXCLUDED.parent_city_id;
  END LOOP;
END $$;
