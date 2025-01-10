use crate::db::model::ContractDbObj;
use sqlx::SqlitePool;

pub async fn insert_contract_obj(
    conn: &SqlitePool,
    contract_data: ContractDbObj,
) -> Result<ContractDbObj, sqlx::Error> {
    let res = sqlx::query_as::<_, ContractDbObj>(
        r"INSERT INTO contract
        (contract_id, user_id, created, network, data, tx, deployed)
        VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        ",
    )
    .bind(contract_data.contract_id)
    .bind(&contract_data.user_id)
    .bind(contract_data.created)
    .bind(&contract_data.network)
    .bind(&contract_data.data)
    .bind(&contract_data.tx)
    .bind(contract_data.deployed)
    .fetch_one(conn)
    .await?;
    Ok(res)
}

pub async fn get_contract_by_id(
    conn: &SqlitePool,
    contract_id: String,
    user_id: String,
) -> Result<Option<ContractDbObj>, sqlx::Error> {
    let res = sqlx::query_as::<_, ContractDbObj>(
        r"SELECT * FROM contract WHERE contract_id = $1 AND user_id = $2;",
    )
    .bind(contract_id)
    .bind(user_id)
    .fetch_optional(conn)
    .await?;
    Ok(res)
}

pub async fn get_all_contracts_by_user(
    conn: &SqlitePool,
    user_id: String,
) -> Result<Vec<ContractDbObj>, sqlx::Error> {
    let res = sqlx::query_as::<_, ContractDbObj>(r"SELECT * FROM contract WHERE user_id=$1")
        .bind(user_id)
        .fetch_all(conn)
        .await?;
    Ok(res)
}

pub async fn delete_contract_by_id(
    conn: &SqlitePool,
    contract_id: String,
    user_id: String,
) -> Result<(), sqlx::Error> {
    sqlx::query(r"DELETE FROM contract WHERE contract_id = $1 AND user_id = $2;")
        .bind(contract_id)
        .bind(user_id)
        .execute(conn)
        .await?;
    Ok(())
}

pub async fn update_contract_data(
    conn: &SqlitePool,
    contract: ContractDbObj,
) -> Result<ContractDbObj, sqlx::Error> {
    let obj = sqlx::query_as::<_, ContractDbObj>(
        r"UPDATE contract
    SET
    data = $1,
    network = $2,
    tx = $3,
    deployed = $4
    WHERE contract_id = $2 AND user_id = $3 RETURNING *;",
    )
    .bind(contract.data)
    .bind(contract.network)
    .bind(contract.contract_id)
    .bind(contract.user_id)
    .bind(contract.tx)
    .bind(contract.deployed)
    .fetch_one(conn)
    .await?;
    Ok(obj)
}
