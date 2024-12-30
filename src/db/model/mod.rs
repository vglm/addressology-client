use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::types::DbAddress;

#[derive(Serialize, Deserialize, sqlx::FromRow, PartialEq, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FancyDbObj {
    pub address: DbAddress,
    pub salt: String,
    pub factory: DbAddress,
    pub created: NaiveDateTime,
    pub score: f64,
    pub miner: String,
}

