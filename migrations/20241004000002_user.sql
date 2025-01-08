CREATE TABLE users
(
    uid                 TEXT NOT NULL,
    email               TEXT NOT NULL,
    pass_hash           TEXT,
    created_date        TEXT NOT NULL,
    last_pass_change    TEXT NOT NULL,

    set_pass_token      TEXT,
    set_pass_token_date TEXT,

    CONSTRAINT users_pk PRIMARY KEY (uid),
    CONSTRAINT idx_users_email UNIQUE (email)
) strict;


CREATE TABLE oauth_stage (
     csrf_state TEXT NOT NULL,
     pkce_code_verifier TEXT NOT NULL,
     created_at TEXT,

     CONSTRAINT oauth_stage_pk PRIMARY KEY (csrf_state)
);

CREATE INDEX oauth_stage_created_at_idx ON oauth_stage (created_at);
