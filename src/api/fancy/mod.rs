use crate::api::utils::extract_url_int_param;
use crate::db::model::{DeployStatus, UserDbObj};
use crate::db::ops::{
    fancy_get_by_address, fancy_list_all, fancy_list_all_free, fancy_list_best_score,
    fancy_list_newest, fancy_update_owner, get_contract_by_id, get_user, insert_fancy_obj,
    update_contract_data, update_user_tokens,
};
use crate::{fancy, login_check_and_get, normalize_address, ServerData};
use actix_session::Session;
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use rand::prelude::SliceRandom;
use serde::Deserialize;
use serde_json::json;
use std::str::FromStr;

pub async fn handle_random(server_data: web::Data<Box<ServerData>>) -> impl Responder {
    let conn = server_data.db_connection.lock().await;
    let list = fancy_list_all_free(&conn).await.unwrap();
    let random = list.choose(&mut rand::thread_rng()).unwrap();

    HttpResponse::Ok().json(random)
}

pub async fn handle_list(server_data: web::Data<Box<ServerData>>) -> impl Responder {
    let conn = server_data.db_connection.lock().await;
    let list = fancy_list_all_free(&conn).await.unwrap();

    HttpResponse::Ok().json(list)
}

pub async fn handle_list_newest(server_data: web::Data<Box<ServerData>>) -> impl Responder {
    let conn = server_data.db_connection.lock().await;
    let list = fancy_list_newest(&conn).await.unwrap();

    HttpResponse::Ok().json(list)
}

pub async fn handle_list_best_score(
    server_data: web::Data<Box<ServerData>>,
    request: HttpRequest,
) -> Result<HttpResponse, actix_web::Error> {
    let conn = server_data.db_connection.lock().await;
    let limit = extract_url_int_param(&request, "limit")?;
    let list = match fancy_list_best_score(&conn, limit.unwrap_or(100)).await {
        Ok(list) => list,
        Err(e) => {
            log::error!("{}", e);
            return Ok(HttpResponse::InternalServerError().finish());
        }
    };

    Ok(HttpResponse::Ok().json(list))
}

pub async fn handle_fancy_estimate_total_hash(
    server_data: web::Data<Box<ServerData>>,
) -> HttpResponse {
    let fancies = {
        let conn = server_data.db_connection.lock().await;
        match fancy_list_all(&conn).await {
            Ok(fancies) => fancies,
            Err(e) => {
                log::error!("{}", e);
                return HttpResponse::InternalServerError().finish();
            }
        }
    };

    let mut total_zeroes = 0;
    #[allow(clippy::collapsible_if)]
    for fancy in fancies {
        if fancy.category == "leading_zeroes" {
            if fancy.score >= 16.0f64.powf(11f64) {
                total_zeroes += 1;
            }
        }
    }
    HttpResponse::Ok().json(json!(
        {
            "totalZeroes": total_zeroes,
            "estimatedWorkTH": total_zeroes as f64 * 16.0f64.powf(11f64) / 1_000_000_000_000.0
        }
    ))
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AddNewData {
    pub salt: String,
    pub miner: String,
    pub factory: String,
    pub address: String,
}

pub async fn handle_fancy_new(
    server_data: web::Data<Box<ServerData>>,
    new_data: web::Json<AddNewData>,
) -> HttpResponse {
    let conn = server_data.db_connection.lock().await;
    let factory = match web3::types::Address::from_str(&new_data.factory) {
        Ok(factory) => factory,
        Err(e) => {
            log::error!("{}", e);
            return HttpResponse::BadRequest().finish();
        }
    };
    let result = match fancy::parse_fancy(new_data.salt.clone(), factory, new_data.miner.clone()) {
        Ok(fancy) => fancy,
        Err(e) => {
            log::error!("{}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    if format!("{:#x}", result.address.addr()) != new_data.address.to_lowercase() {
        log::error!(
            "Address mismatch expected: {}, got: {}",
            format!("{:#x}", result.address.addr()),
            new_data.address.to_lowercase()
        );
        return HttpResponse::BadRequest().body("Address mismatch");
    }

    println!("{:?}", result);
    match insert_fancy_obj(&conn, result).await {
        Ok(_) => HttpResponse::Ok().body("Entry accepted"),
        Err(e) => {
            if e.to_string().contains("UNIQUE constraint failed") {
                HttpResponse::Ok().body("Already exists")
            } else {
                log::error!("{}", e);
                HttpResponse::InternalServerError().finish()
            }
        }
    }
}

pub async fn handle_fancy_deploy_start(
    server_data: web::Data<Box<ServerData>>,
    contract_id: web::Path<String>,
    session: Session,
) -> HttpResponse {
    let user: UserDbObj = login_check_and_get!(session);
    let contract_id = contract_id.into_inner();

    let conn = server_data.db_connection.lock().await;

    let contract = match get_contract_by_id(&*conn, contract_id, user.uid.clone()).await {
        Ok(Some(contract)) => {
            let mut contract = contract;
            match contract.deploy_status {
                DeployStatus::None => {
                    contract.deploy_status = DeployStatus::Requested;
                    contract
                }
                DeployStatus::Requested => return HttpResponse::Ok().body("Already requested"),
                DeployStatus::TxSent => return HttpResponse::Ok().body("Already sent"),
                DeployStatus::Failed => return HttpResponse::Ok().body("Deployment Failed"),
                DeployStatus::Succeeded => return HttpResponse::Ok().body("Deployment Succeeded"),
            }
        }
        Ok(None) => {
            return HttpResponse::NotFound().finish();
        }
        Err(e) => {
            log::error!("{}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    match update_contract_data(&*conn, contract).await {
        Ok(contr) => HttpResponse::Ok().json(contr),
        Err(err) => {
            log::error!("Error updating contract data {}", err);
            HttpResponse::InternalServerError().finish()
        }
    }
}
pub async fn handle_fancy_buy_api(
    server_data: web::Data<Box<ServerData>>,
    address: web::Path<String>,
    session: Session,
) -> HttpResponse {
    let user: UserDbObj = login_check_and_get!(session);

    let address = address.into_inner();

    let conn = server_data.db_connection.lock().await;

    let mut trans = match conn.begin().await {
        Ok(tx) => tx,
        Err(err) => {
            log::error!("Error starting transaction: {}", err);
            return HttpResponse::InternalServerError().finish();
        }
    };

    let user_for_tx = match get_user(&mut *trans, &user.email).await {
        Ok(user) => user,
        Err(err) => {
            log::error!("Error getting user: {}", err);
            return HttpResponse::InternalServerError().finish();
        }
    };

    let address = normalize_address!(address);
    let address_db = match fancy_get_by_address(&mut *trans, address).await {
        Ok(Some(addr)) => addr,
        Ok(None) => {
            log::error!("Address not found: {}", address);
            return HttpResponse::NotFound().finish();
        }
        Err(err) => {
            log::error!("Error getting address: {}", err);
            return HttpResponse::InternalServerError().finish();
        }
    };

    if address_db.owner.is_some() {
        log::error!("Address already owned: {}", address);
        return HttpResponse::BadRequest().body("Address already owned");
    }

    if user_for_tx.tokens < address_db.price {
        log::error!(
            "User has insufficient funds: {} < {}",
            user_for_tx.tokens,
            address_db.price
        );
        return HttpResponse::BadRequest().body("Insufficient funds");
    }

    match fancy_update_owner(&mut *trans, address, user.uid.clone()).await {
        Ok(_) => {}
        Err(err) => {
            log::error!("Error updating owner: {}", err);
            return HttpResponse::InternalServerError().finish();
        }
    }

    match update_user_tokens(
        &mut *trans,
        &user.uid,
        user_for_tx.tokens - address_db.price,
    )
    .await
    {
        Ok(_) => {}
        Err(err) => {
            log::error!("Error updating user tokens: {}", err);
            return HttpResponse::InternalServerError().finish();
        }
    }

    match trans.commit().await {
        Ok(_) => HttpResponse::Ok().finish(),
        Err(err) => {
            log::error!("Error committing transaction: {}", err);
            HttpResponse::InternalServerError().finish()
        }
    }
}
