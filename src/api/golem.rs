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

pub async fn get_last_exe_unit_log(
    data: Data<Box<ServerData>>,
    _req: HttpRequest,
) -> Result<HttpResponse, error::Error> {
    let runner = lock_with_timeout!(data.provider_runner)?;

    match runner.get_last_exe_unit_log().await {
        Ok(log) => Ok(HttpResponse::Ok().json(log)),
        Err(err) => {
            log::error!("Failed to get last exeunit log: {err}");
            Err(error::ErrorInternalServerError(format!(
                "Failed to get last exe-unit log: {err}"
            )))
        }
    }
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

pub async fn proxy_get_offers(data: Data<Box<ServerData>>) -> Result<HttpResponse, error::Error> {
    let settings = {
        //no need to block whole function
        lock_with_timeout!(data.yagna_runner)?.settings()
    };

    let target_url = format!("{}/market-api/v1/offers", settings.api_url);
    let client = reqwest::Client::new();
    let response = client
        .get(&target_url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", settings.app_key))
        .send()
        .await
        .map_err(|e| {
            log::error!("Failed to send request: {}", e);
            error::ErrorInternalServerError("Failed to send request")
        })?;
    if response.status().is_success() {
        let body = response.bytes().await.map_err(|e| {
            log::error!("Failed to read response body: {}", e);
            error::ErrorInternalServerError("Failed to read response body")
        })?;
        let offers = serde_json::from_slice::<serde_json::Value>(&body).map_err(|e| {
            log::error!("Failed to parse response body: {}", e);
            error::ErrorInternalServerError("Failed to parse response body")
        })?;
        Ok(HttpResponse::Ok().json(offers))
    } else {
        let status = response.status();
        let body_text = response.text().await.unwrap_or_default();
        Err(error::ErrorInternalServerError(format!(
            "Yagna request failed. status code: {} body: {}",
            status, body_text
        )))
    }
}
