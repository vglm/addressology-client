use crate::api::runners::{consume_results, disable, enable, kill, list_runners, set_runners_target, start, stop};
use actix_web::{web, Scope};

#[rustfmt::skip]
pub fn server_api_scope() -> Scope {
    Scope::new("/api")
        .route("/runners", web::get().to(list_runners))
        .route("/runner/{runner_no}/start", web::post().to(start))
        .route("/runner/{runner_no}/stop", web::post().to(stop))
        .route("/runner/{runner_no}/kill", web::post().to(kill))
        .route("/runner/{runner_no}/enable", web::post().to(enable))
        .route("/runner/{runner_no}/disable", web::post().to(disable))
        .route("/runners/target/set", web::post().to(set_runners_target))
        .route("/runners/results/consume", web::post().to(consume_results))
}
