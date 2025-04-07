use crate::api::golem::{
    clean_yagna, configure_provider, get_all_historical_activity_info, get_last_exe_unit_log,
    provider_info, proxy_get_offers, start_provider, start_yagna, stop_provider, stop_yagna,
    yagna_info,
};
use crate::api::runners::{
    consume_results, disable, enable, kill, list_runners, runners_start, runners_stop,
    set_runners_target, start, start_benchmark, stop,
};
use actix_web::{web, Scope};

#[rustfmt::skip]
pub fn server_api_scope() -> Scope {
    Scope::new("/api")
        .route("/runners", web::get().to(list_runners))
        .route("/runner/{runner_no}/start", web::post().to(start))
        .route("/runner/{runner_no}/benchmark/start", web::post().to(start_benchmark))
        .route("/runner/{runner_no}/stop", web::post().to(stop))
        .route("/runner/{runner_no}/kill", web::post().to(kill))
        .route("/runner/{runner_no}/enable", web::post().to(enable))
        .route("/runner/{runner_no}/disable", web::post().to(disable))
        .route("/runners/target/set", web::post().to(set_runners_target))
        .route("/runners/results/consume", web::post().to(consume_results))
        .route("/runners/start", web::post().to(runners_start))
        .route("/runners/stop", web::post().to(runners_stop))
        .route("/yagna/start", web::post().to(start_yagna))
        .route("/yagna/info", web::get().to(yagna_info))
        .route("/provider/start", web::post().to(start_provider))
        .route("/provider/stop", web::post().to(stop_provider))
        .route("/provider/configure", web::post().to(configure_provider))
        .route("/provider/info", web::get().to(provider_info))
        .route("/provider/activity/details", web::get().to(get_last_exe_unit_log))
        .route("/provider/activity/all", web::get().to(get_all_historical_activity_info))
        .route("/yagna/stop", web::post().to(stop_yagna))
        .route("/yagna/clean", web::post().to(clean_yagna))
        .route("/yagna/market/offers", web::get().to(proxy_get_offers))

       // .route("/provider/clean", web::post().to(clean_provider))

}
