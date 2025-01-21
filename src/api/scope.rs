use crate::api;
use crate::api::contract::compile::handle_compile;
use crate::api::fancy::{
    handle_fancy_buy_api, handle_fancy_deploy_start, handle_fancy_estimate_total_hash,
    handle_fancy_new, handle_list, handle_list_best_score, handle_list_newest, handle_random,
};
use crate::api::oauth::google::{handle_google_callback, handle_login_via_google};
use crate::api::user;
use crate::api::user::handle_greet;
use actix_web::{web, Scope};

pub fn server_api_scope() -> actix_web::Scope {
    Scope::new("/api")
        .route(
            "/auth/callback/google",
            web::get().to(handle_google_callback),
        )
        .route("/auth/login/google", web::get().to(handle_login_via_google))
        .route("/login", web::post().to(user::handle_login))
        .route("/session/check", web::get().to(user::handle_session_check))
        .route("/is_login", web::get().to(user::handle_is_login))
        .route("/is_login", web::post().to(user::handle_is_login))
        .route("/logout", web::post().to(user::handle_logout))
        .route("/reset_pass", web::post().to(user::handle_password_reset))
        .route("/set_pass", web::post().to(user::handle_password_set))
        .route("/change_pass", web::post().to(user::handle_password_change))
        .route("/fancy/random", web::get().to(handle_random))
        .route("/fancy/list", web::get().to(handle_list))
        .route("/fancy/list_newest", web::get().to(handle_list_newest))
        .route(
            "/fancy/total_hash",
            web::get().to(handle_fancy_estimate_total_hash),
        )
        .route(
            "/fancy/list_best_score",
            web::get().to(handle_list_best_score),
        )
        .route("/fancy/new", web::post().to(handle_fancy_new))
        .route("/fancy/buy/{address}", web::post().to(handle_fancy_buy_api))
        .route(
            "/fancy/deploy/{contract_id}",
            web::post().to(handle_fancy_deploy_start),
        )
        .route("/contract/compile", web::post().to(handle_compile))
        .route("/greet", web::get().to(handle_greet))
        .route(
            "/contract/{contract_id}",
            web::get().to(api::contract::get_contract_info_api),
        )
        .route(
            "/contract/new",
            web::post().to(api::contract::insert_contract_info_api),
        )
        .route(
            "/contract/{contract_id}",
            web::post().to(api::contract::update_contract_info_api),
        )
        .route(
            "/contracts/list",
            web::get().to(api::contract::get_contracts_api),
        )
        .route(
            "contract/{contract_id}/delete",
            web::post().to(api::contract::delete_contract_api),
        )
}
