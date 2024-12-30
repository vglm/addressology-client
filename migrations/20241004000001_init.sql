CREATE TABLE fancy
(
    address             TEXT NOT NULL,
    salt                TEXT NOT NULL,
    factory             TEXT NOT NULL,
    created             TEXT NOT NULL,
    score               REAL NOT NULL,
    miner               TEXT NOT NULL,

    CONSTRAINT fancy_pk PRIMARY KEY (address)
) strict;
