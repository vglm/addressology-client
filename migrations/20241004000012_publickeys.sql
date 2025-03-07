

CREATE TABLE public_key_base (
    id TEXT NOT NULL,
    hex TEXT NOT NULL,
    added TEXT NOT NULL,
    user_id TEXT NULL,
    CONSTRAINT public_key_base_pk PRIMARY KEY (id),
    CONSTRAINT public_key_base_hex2 UNIQUE (hex),
    FOREIGN KEY (user_id) REFERENCES users (uid)
);

INSERT INTO public_key_base (id, hex, added)
SELECT '5a7a2dec-bc41-4d0c-b9ee-c20710144cc8', public_key_base, '2025-03-07' FROM fancy
WHERE public_key_base IS NOT NULL
GROUP BY public_key_base;

ALTER TABLE fancy RENAME TO fancy_old;

CREATE TABLE fancy (
    address TEXT NOT NULL,
    salt TEXT NOT NULL,
    factory TEXT NULL,
    public_key_base TEXT NULL,
    created TEXT NOT NULL,
    score REAL NOT NULL,
    job TEXT NULL,
    owner TEXT NULL,
    price INTEGER NOT NULL DEFAULT 1000,
    category TEXT NULL,
    CONSTRAINT fancy_pk PRIMARY KEY (address),
    CONSTRAINT fancy_fk FOREIGN KEY (job) REFERENCES job_info (uid),
    CONSTRAINT fancy_fk2 FOREIGN KEY (public_key_base)
        REFERENCES public_key_base (hex) ON DELETE CASCADE
) STRICT;



INSERT INTO fancy (address, salt, factory, public_key_base, created, score, owner, price, category)
SELECT address, salt, factory, public_key_base, created, score, owner, price, category
FROM fancy_old;
DROP TABLE fancy_old;

UPDATE fancy
SET factory = NULL
WHERE factory = '0x0000000000000000000000000000000000000000';
