use crate::db::model::FancyDbObj;
use crate::types::DbAddress;
use sqlx::SqlitePool;

pub async fn insert_fancy_obj(
    conn: &SqlitePool,
    fancy_data: FancyDbObj,
) -> Result<FancyDbObj, sqlx::Error> {
    let res = sqlx::query_as::<_, FancyDbObj>(
        r"INSERT INTO fancy
(address, salt, factory, created, score, miner)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
",
    )
    .bind(fancy_data.address)
    .bind(&fancy_data.salt)
    .bind(fancy_data.factory)
    .bind(fancy_data.created)
    .bind(fancy_data.score)
    .bind(&fancy_data.miner)
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn list_all(conn: &SqlitePool) -> Result<Vec<FancyDbObj>, sqlx::Error> {
    let res = sqlx::query_as::<_, FancyDbObj>(r"SELECT * FROM fancy;")
        .fetch_all(conn)
        .await?;
    Ok(res)
}
pub async fn get_by_address(
    conn: &SqlitePool,
    address: DbAddress,
) -> Result<Option<FancyDbObj>, sqlx::Error> {
    let res = sqlx::query_as::<_, FancyDbObj>(r"SELECT * FROM fancy WHERE address = $1;")
        .bind(address)
        .fetch_optional(conn)
        .await?;
    Ok(res)
}
