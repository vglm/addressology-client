use crate::ServerData;
use actix_web::web::Data;
use actix_web::{error, HttpRequest, HttpResponse};
use serde_json::json;

macro_rules! lock_with_timeout {
    ($lock_obj:expr) => {{
        match tokio::time::timeout(std::time::Duration::from_secs(5), $lock_obj.lock()).await {
            Ok(guard) => Ok(guard),
            Err(_) => {
                log::error!(
                    "Timed out while waiting for runner lock ({}:{}:{})",
                    file!(),
                    line!(),
                    column!()
                );
                Err(error::ErrorInternalServerError(
                    "Timed out while waiting for runner lock",
                ))
            }
        }
    }};
}

pub async fn yagna_info(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let runner = lock_with_timeout!(data.yagna_runner)?;

    let res = if runner.is_started() {
        HttpResponse::Ok().json(json!({
            "status": "running",
        }))
    } else {
        HttpResponse::Ok().json(json!({
            "status": "stopped",
        }))
    };
    Ok(res)
}

pub async fn provider_info(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let runner = lock_with_timeout!(data.provider_runner)?;

    let res = if runner.is_started() {
        HttpResponse::Ok().json(json!({
            "status": "running",
        }))
    } else {
        HttpResponse::Ok().json(json!({
            "status": "stopped",
        }))
    };
    Ok(res)
}

pub async fn start_yagna(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let mut runner = lock_with_timeout!(data.yagna_runner)?;

    match runner.start().await {
        Ok(()) => Ok(HttpResponse::Ok().body("Yagna runner started")),
        Err(err) => Err(error::ErrorInternalServerError(format!(
            "Failed to start runner {err}"
        ))),
    }
}

pub async fn start_provider(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let mut runner = lock_with_timeout!(data.provider_runner)?;

    match runner.start().await {
        Ok(()) => Ok(HttpResponse::Ok().body("Provider runner started")),
        Err(err) => Err(error::ErrorInternalServerError(format!(
            "Failed to start runner {err}"
        ))),
    }
}

pub async fn stop_provider(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let mut runner = lock_with_timeout!(data.provider_runner)?;

    match runner.stop().await {
        Ok(_) => Ok(HttpResponse::Ok().body("Provider runner stopped")),
        Err(err) => Err(error::ErrorInternalServerError(format!(
            "Failed to stop runner {err}"
        ))),
    }
}

pub async fn clean_yagna(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let runner = lock_with_timeout!(data.yagna_runner)?;

    match runner.clean_data().await {
        Ok(_) => Ok(HttpResponse::Ok().body("Yagna runner cleaned")),
        Err(err) => {
            log::error!("Failed to clean runner {err}");
            Err(error::ErrorInternalServerError(format!(
                "Failed to clean runner {err}"
            )))
        }
    }
}

pub async fn stop_yagna(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let mut runner = lock_with_timeout!(data.yagna_runner)?;

    match runner.stop().await {
        Ok(_) => Ok(HttpResponse::Ok().body("Yagna runner stopped")),
        Err(err) => Err(error::ErrorInternalServerError(format!(
            "Failed to stop runner {err}"
        ))),
    }
}

pub async fn configure_provider(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let mut runner = lock_with_timeout!(data.provider_runner)?;

    match runner.configure().await {
        Ok(_) => Ok(HttpResponse::Ok().body("Provider runner configured")),
        Err(err) => Err(error::ErrorInternalServerError(format!(
            "Failed to configure runner {err}"
        ))),
    }
}
