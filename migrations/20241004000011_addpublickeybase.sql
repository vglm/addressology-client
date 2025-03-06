

ALTER TABLE fancy ADD COLUMN public_key_base TEXT NULL;

CREATE INDEX fancy_public_key_base_idx ON fancy (public_key_base);