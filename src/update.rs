use actix_multipart::Multipart;
use actix_web::{Error, HttpRequest, HttpResponse};
use futures_util::StreamExt as _;
use std::env;
use std::fs::File;
use std::io::Write;

pub async fn push_update(
    mut payload: Multipart,
    request: HttpRequest,
) -> Result<HttpResponse, Error> {
    //log all headers

    if let Ok(update_secret) = env::var("UPDATE_SECRET") {
        if update_secret.len() < 10 {
            log::error!("Update secret is too short");
            return Ok(HttpResponse::Unauthorized().body("Update not possible"));
        }
        if update_secret
            != request
                .headers()
                .get("update-secret")
                .map(|v| v.to_str().unwrap_or(""))
                .unwrap_or("")
        {
            log::warn!("Trying to update without correct secret");
            return Ok(HttpResponse::Unauthorized().body("Update not possible"));
        }
    } else {
        log::warn!("Trying to update when it is not possible");
        return Ok(HttpResponse::Unauthorized().body("Update not possible"));
    }

    // Iterate over multipart stream
    while let Some(field) = payload.next().await {
        let mut field = field?;

        let str_now = chrono::Utc::now().timestamp_millis().to_string();
        let tmp_file = format!("./tmp_{str_now}");
        let target_file = format!("./update_{str_now}");
        // Create a file in the local filesystem with the same name
        let mut f = File::create(&tmp_file)?;

        // Write chunks to the file
        while let Some(chunk) = field.next().await {
            let data = chunk?;
            f.write_all(&data)?;
        }
        // mv file to correct location
        std::fs::rename(&tmp_file, &target_file)?;
    }

    Ok(HttpResponse::Ok().body("File uploaded successfully"))
}
