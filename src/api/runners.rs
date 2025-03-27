use crate::runner::{WorkTarget};
use crate::ServerData;
use actix_web::web::Data;
use actix_web::{web, HttpRequest, HttpResponse};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::timeout;

pub async fn list_runners(data: Data<Box<ServerData>>) -> HttpResponse {
    let mut runners: Vec<Value> = Vec::with_capacity(data.runners.len());
    for runner in data.runners.iter() {
        let runner = match timeout(Duration::from_secs(5), runner.lock()).await {
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
            "currentTarget": runner.current_target(),
            "workTarget": runner.work_target(),
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
            Ok(_) => HttpResponse::Ok().body("Runner stopped"),
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
            Ok(true) => HttpResponse::Ok().body("Runner killed"),
            Ok(false) => HttpResponse::Ok().body("Runner already killed"),
            Err(err) => {
                HttpResponse::InternalServerError().body(format!("Failed to kill runner {err}"))
            }
        }
    } else {
        HttpResponse::NotFound().body("Runner not found")
    }
}

pub async fn set_runners_target(
    data: Data<Box<ServerData>>,
    wt: web::Json<WorkTarget>,
) -> HttpResponse {
    for runner in data.runners.iter() {
        let mut runner = match timeout(Duration::from_secs(5), runner.lock()).await {
            Ok(guard) => guard,
            Err(_) => {
                return HttpResponse::RequestTimeout()
                    .body("Timed out while waiting for runner lock");
            }
        };
        runner.set_target(wt.clone());
    }
    HttpResponse::Ok().body("Target set to all runners")
}
