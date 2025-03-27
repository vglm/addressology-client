use crate::api::runners::{kill, list_runners, set_runners_target, start, stop};
use actix_web::{web, Scope};

#[rustfmt::skip]
pub fn server_api_scope() -> Scope {
    Scope::new("/api")
        .route("/runners", web::get().to(list_runners))
        .route("/runner/{runner_no}/start", web::post().to(start))
        .route("/runner/{runner_no}/stop", web::post().to(stop))
        .route("/runner/{runner_no}/kill", web::post().to(kill))
        .route("/runners/target/set", web::post().to(set_runners_target))
}
