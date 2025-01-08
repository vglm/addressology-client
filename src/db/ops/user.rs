use crate::db::model::{OauthStageDbObj, UserDbObj};
use sqlx::SqlitePool;

pub async fn insert_oauth_stage(
    conn: &SqlitePool,
    oauth_data: OauthStageDbObj,
) -> Result<OauthStageDbObj, sqlx::Error> {
    let res = sqlx::query_as::<_, OauthStageDbObj>(
        r"INSERT INTO oauth_stage
(csrf_state, pkce_code_verifier, created_at)
VALUES ($1, $2, $3) RETURNING *;
",
    )
    .bind(&oauth_data.csrf_state)
    .bind(&oauth_data.pkce_code_verifier)
    .bind(oauth_data.created_at)
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_and_remove_oauth_stage(
    conn: &SqlitePool,
    csrf_state: &str,
) -> Result<Option<OauthStageDbObj>, sqlx::Error> {
    let res = sqlx::query_as::<_, OauthStageDbObj>(
        r"DELETE FROM oauth_stage WHERE csrf_state = $1 RETURNING *;",
    )
    .bind(csrf_state)
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn delete_old_oauth_stages(conn: &SqlitePool) -> Result<(), sqlx::Error> {
    let _res = sqlx::query(r"DELETE FROM oauth_stage WHERE created_at < $1")
        .bind(chrono::Utc::now() - chrono::Duration::minutes(10))
        .execute(conn)
        .await?;
    Ok(())
}

#[allow(dead_code)]
pub async fn insert_user(conn: &SqlitePool, user: &UserDbObj) -> Result<UserDbObj, sqlx::Error> {
    let res = sqlx::query_as::<_, UserDbObj>(
        r"INSERT INTO users
(uid, email, pass_hash, created_date, last_pass_change)
VALUES ($1, $2, $3, $4, $5) RETURNING *;
",
    )
    .bind(&user.uid)
    .bind(&user.email)
    .bind(&user.pass_hash)
    .bind(user.created_date)
    .bind(user.last_pass_change)
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn save_reset_token(
    conn: &SqlitePool,
    email: &str,
    reset_token: &str,
) -> Result<(), sqlx::Error> {
    let _res = sqlx::query(
        r"UPDATE users SET set_pass_token = $1, set_pass_token_date = $2 WHERE email = $3",
    )
    .bind(reset_token)
    .bind(chrono::Utc::now())
    .bind(email)
    .execute(conn)
    .await?;
    Ok(())
}

pub async fn update_user_password(
    conn: &SqlitePool,
    email: &str,
    new_pass_hash: &str,
) -> Result<(), sqlx::Error> {
    let _res = sqlx::query(
        r"UPDATE users SET
pass_hash = $1,
set_pass_token = null,
set_pass_token_date = null
WHERE email = $2
",
    )
    .bind(new_pass_hash)
    .bind(email)
    .execute(conn)
    .await?;
    Ok(())
}

#[allow(dead_code)]
pub async fn update_user(conn: &SqlitePool, user: &UserDbObj) -> Result<UserDbObj, sqlx::Error> {
    let _res = sqlx::query(
        r"UPDATE users SET
uid = $1,
email = $2,
pass_hash = $3,
created_date = $4,
last_pass_change = $5,
set_pass_token = $6,
set_pass_token_date = $7
WHERE id = $1
",
    )
    .bind(&user.uid)
    .bind(&user.email)
    .bind(&user.pass_hash)
    .bind(user.created_date)
    .bind(user.last_pass_change)
    .bind(&user.set_pass_token)
    .bind(user.set_pass_token_date)
    .execute(conn)
    .await?;
    Ok(user.clone())
}

pub async fn get_user(conn: &SqlitePool, email: &str) -> Result<UserDbObj, sqlx::Error> {
    let res = sqlx::query_as::<_, UserDbObj>(r"SELECT * FROM users WHERE email = $1")
        .bind(email)
        .fetch_one(conn)
        .await?;
    Ok(res)
}

#[tokio::test]
async fn tx_test() -> sqlx::Result<()> {
    println!("Start tx_test...");

    use crate::create_sqlite_connection;
    let conn = create_sqlite_connection(None, None, false, true)
        .await
        .unwrap();

    println!("In memory DB created");

    let created_date = chrono::Utc::now();
    let last_pass_change = chrono::Utc::now() + chrono::Duration::days(1);
    let user_to_insert = UserDbObj {
        uid: uuid::Uuid::new_v4().to_string(),
        email: "random@mail.domain".to_string(),
        pass_hash: "324235235".to_string(),
        created_date,
        last_pass_change,
        set_pass_token: None,
        set_pass_token_date: None,
    };

    let user_from_insert = insert_user(&conn, &user_to_insert).await?;
    let user_from_dao = get_user(&conn, &user_from_insert.email).await?;

    //all three should be equal
    assert_eq!(user_to_insert, user_from_dao);
    assert_eq!(user_from_insert, user_from_dao);

    Ok(())
}
