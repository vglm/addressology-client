CREATE TABLE users
(
    uid                 TEXT NOT NULL,
    email               TEXT NOT NULL,
    pass_hash           TEXT,
    created_date        TEXT NOT NULL,
    last_pass_change    TEXT NOT NULL,

    set_pass_token      TEXT,
    set_pass_token_date TEXT,

    allow_pass_login    INT NULL,
    allow_google_login  INT NULL,

    tokens              INTEGER NOT NULL DEFAULT 1000000,

    CONSTRAINT users_pk PRIMARY KEY (uid),
    CONSTRAINT idx_users_email UNIQUE (email)
) STRICT;

CREATE TABLE oauth_stage (
    csrf_state TEXT NOT NULL,
    pkce_code_verifier TEXT NOT NULL,
    created_at TEXT,

    CONSTRAINT oauth_stage_pk PRIMARY KEY (csrf_state)
);

CREATE INDEX oauth_stage_created_at_idx ON oauth_stage (created_at);

CREATE TABLE miner_info (
    uid TEXT NOT NULL,
    prov_node_id TEXT NULL,
    prov_reward_addr TEXT NULL,
    prov_name TEXT NULL,
    prov_extra_info TEXT NULL,
    CONSTRAINT miner_info_pk PRIMARY KEY (uid)
) STRICT;

CREATE TABLE job_info (
    uid TEXT NOT NULL,
    cruncher_ver TEXT NOT NULL,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT NULL,
    requestor_id TEXT NULL,
    hashes_reported REAL NOT NULL,
    hashes_accepted REAL NOT NULL,
    entries_accepted INTEGER NOT NULL,
    entries_rejected INTEGER NOT NULL,
    cost_reported REAL NOT NULL,
    miner TEXT NULL,
    job_extra_info TEXT NULL,
    CONSTRAINT job_info_pk PRIMARY KEY (uid),
    FOREIGN KEY (miner) REFERENCES miner_info (uid)
) STRICT;

CREATE INDEX job_info_started_at_idx ON job_info (started_at);
CREATE INDEX job_info_updated_at_idx ON job_info (updated_at);
CREATE INDEX job_info_finished_at_idx ON job_info (finished_at);

CREATE TABLE contract_factory (
    id TEXT NOT NULL,
    address TEXT NOT NULL,
    added TEXT NOT NULL,
    user_id TEXT NULL,
    CONSTRAINT public_key_base_pk PRIMARY KEY (id),
    CONSTRAINT public_key_base_address2 UNIQUE (address),
    FOREIGN KEY (user_id) REFERENCES users (uid)
) STRICT;

CREATE TABLE public_key_base (
    id TEXT NOT NULL,
    hex TEXT NOT NULL,
    added TEXT NOT NULL,
    user_id TEXT NULL,
    CONSTRAINT public_key_base_pk PRIMARY KEY (id),
    CONSTRAINT public_key_base_hex2 UNIQUE (hex),
    FOREIGN KEY (user_id) REFERENCES users (uid)
) STRICT;

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
    CONSTRAINT fancy_fk1 FOREIGN KEY (owner) REFERENCES users (uid),
    CONSTRAINT fancy_fk2 FOREIGN KEY (public_key_base) REFERENCES public_key_base (hex) ON DELETE CASCADE,
    CONSTRAINT fancy_fk3 FOREIGN KEY (factory) REFERENCES contract_factory (address) ON DELETE CASCADE
) STRICT;

CREATE INDEX fancy_owner_idx ON fancy (owner);
CREATE INDEX fancy_price_idx ON fancy (price);
CREATE INDEX fancy_score_idx ON fancy (score);
CREATE INDEX fancy_factory_idx ON fancy (factory);
CREATE INDEX fancy_category_idx ON fancy (category);
CREATE INDEX fancy_public_key_base_idx ON fancy (public_key_base);

CREATE TABLE contract
(
    contract_id TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    created     TEXT NOT NULL,
    address     TEXT NULL,
    network     TEXT NOT NULL,
    data        TEXT NOT NULL,
    tx          TEXT NULL,
    deployed    TEXT NULL,
    deploy_status TEXT NOT NULL DEFAULT '',
    deploy_requested TEXT NULL,
    deploy_sent TEXT NULL,

    FOREIGN KEY (user_id) REFERENCES users (uid),
    FOREIGN KEY (address) REFERENCES fancy (address),
    CONSTRAINT contract_pk PRIMARY KEY (contract_id)
) STRICT;

CREATE UNIQUE INDEX unique_address_network_idx on contract (address, network);

