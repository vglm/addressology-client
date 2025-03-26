use crate::runner::{CrunchRunner, CrunchRunnerData};
use crate::ServerData;
use actix_web::web::Data;
use actix_web::{web, HttpRequest, HttpResponse, Scope};
use awc::Client;
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::MutexGuard;
use tokio::time::error::Elapsed;
use tokio::time::timeout;

pub async fn list_runners(data: Data<Box<ServerData>>) -> HttpResponse {
    let mut runners: Vec<Value> = Vec::with_capacity(data.runners.len());
    for runner in data.runners.iter() {
        let mut runner = match timeout(Duration::from_secs(5), runner.lock()).await {
            Ok(guard) => guard,
            Err(_) => {
                return HttpResponse::RequestTimeout()
                    .body("Timed out while waiting for runner lock");
            }
        };

        log::trace!("Runner: {:?}", *runner);
        runners.push(json!({
            "data": runner.shared_data(),
            "started": runner.is_started(),
        }));
    }
    HttpResponse::Ok().json(runners)
}

pub async fn start(data: Data<Box<ServerData>>, req: HttpRequest) -> HttpResponse {
    let runner_no: usize = match req.match_info().query("runner_no").parse() {
        Ok(num) => num,
        Err(_) => return HttpResponse::BadRequest().body("Invalid runner number"),
    };

    if let Some(runner) = data.runners.get(runner_no) {
        let mut runner = match timeout(Duration::from_secs(5), runner.lock()).await {
            Ok(guard) => guard,
            Err(_) => {
                return HttpResponse::RequestTimeout()
                    .body("Timed out while waiting for runner lock");
            }
        };
        match runner.start().await {
            Ok(()) => HttpResponse::Ok().body("Runner started"),
            Err(err) => {
                HttpResponse::InternalServerError().body(format!("Failed to start runner {err}"))
            }
        }
    } else {
        HttpResponse::NotFound().body("Runner not found")
    }
}

pub async fn stop(data: Data<Box<ServerData>>, req: HttpRequest) -> HttpResponse {
    let runner_no: usize = match req.match_info().query("runner_no").parse() {
        Ok(num) => num,
        Err(_) => return HttpResponse::BadRequest().body("Invalid runner number"),
    };

    if let Some(runner) = data.runners.get(runner_no) {
        let mut runner = match timeout(Duration::from_secs(5), runner.lock()).await {
            Ok(guard) => guard,
            Err(_) => {
                return HttpResponse::RequestTimeout()
                    .body("Timed out while waiting for runner lock");
            }
        };
        match runner.stop().await {
            Ok(()) => HttpResponse::Ok().body("Runner stopped"),
            Err(err) => {
                HttpResponse::InternalServerError().body(format!("Failed to stop runner {err}"))
            }
        }
    } else {
        HttpResponse::NotFound().body("Runner not found")
    }
}

pub async fn kill(data: Data<Box<ServerData>>, req: HttpRequest) -> HttpResponse {
    let runner_no: usize = match req.match_info().query("runner_no").parse() {
        Ok(num) => num,
        Err(_) => return HttpResponse::BadRequest().body("Invalid runner number"),
    };

    if let Some(runner) = data.runners.get(runner_no) {
        let mut runner = match timeout(Duration::from_secs(5), runner.lock()).await {
            Ok(guard) => guard,
            Err(_) => {
                return HttpResponse::RequestTimeout()
                    .body("Timed out while waiting for runner lock");
            }
        };

        match runner.kill().await {
            Ok(()) => HttpResponse::Ok().body("Runner killed"),
            Err(err) => {
                HttpResponse::InternalServerError().body(format!("Failed to kill runner {err}"))
            }
        }
    } else {
        HttpResponse::NotFound().body("Runner not found")
    }
}

#[rustfmt::skip]
pub fn server_api_scope() -> Scope {
    Scope::new("/api")
        .route("/runners", web::get().to(list_runners))
        .route("/runner/{runner_no}/start", web::post().to(start))
        .route("/runner/{runner_no}/stop", web::post().to(stop))
        .route("/runner/{runner_no}/kill", web::post().to(kill))
}
