use std::time::Duration;
use actix_web::{HttpRequest, HttpResponse};
use actix_web::web::Data;
use serde_json::json;
use tokio::time::timeout;
use crate::ServerData;

pub async fn yagna_info(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.yagna_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    if runner.is_started() {
        HttpResponse::Ok().json(json!({
            "status": "running",
        }))
    } else {
        HttpResponse::Ok().json(json!({
            "status": "stopped",
        }))
    }
}

pub async fn provider_info(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.provider_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    if runner.is_started() {
        HttpResponse::Ok().json(json!({
            "status": "running",
        }))
    } else {
        HttpResponse::Ok().json(json!({
            "status": "stopped",
        }))
    }
}

pub async fn start_yagna(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.yagna_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    match runner.start().await {
        Ok(()) => HttpResponse::Ok().body("Yagna runner started"),
        Err(err) => {
            HttpResponse::InternalServerError().body(format!("Failed to start runner {err}"))
        }
    }
}

pub async fn start_provider(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.provider_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    match runner.start().await {
        Ok(()) => HttpResponse::Ok().body("Provider runner started"),
        Err(err) => {
            HttpResponse::InternalServerError().body(format!("Failed to start runner {err}"))
        }
    }
}

pub async fn stop_provider(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.provider_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    match runner.stop().await {
        Ok(_) => HttpResponse::Ok().body("Provider runner stopped"),
        Err(err) => {
            HttpResponse::InternalServerError().body(format!("Failed to stop runner {err}"))
        }
    }
}

pub async fn stop_yagna(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.yagna_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    match runner.stop().await {
        Ok(_) => HttpResponse::Ok().body("Yagna runner stopped"),
        Err(err) => {
            HttpResponse::InternalServerError().body(format!("Failed to stop runner {err}"))
        }
    }
}

pub async fn configure_provider(data: Data<Box<ServerData>>, _req: HttpRequest) -> HttpResponse {
    let mut runner = match timeout(Duration::from_secs(5), data.provider_runner.lock()).await {
        Ok(guard) => guard,
        Err(_) => {
            return HttpResponse::RequestTimeout()
                .body("Timed out while waiting for runner lock");
        }
    };

    match runner.configure().await {
        Ok(_) => HttpResponse::Ok().body("Provider runner configured"),
        Err(err) => {
            HttpResponse::InternalServerError().body(format!("Failed to configure runner {err}"))
        }
    }
}