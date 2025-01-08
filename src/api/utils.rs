use actix_web::HttpRequest;
use percent_encoding::percent_decode_str;

pub fn extract_url_param(
    request: &HttpRequest,
    param: &str,
) -> Result<Option<String>, actix_web::Error> {
    for (key, value) in request.query_string().split('&').map(|x| {
        let mut split = x.split('=');
        (split.next().unwrap_or(""), split.next().unwrap_or(""))
    }) {
        if key == param {
            return match percent_decode_str(value).decode_utf8() {
                Ok(val) => Ok(Some(val.to_string())),
                Err(err) => Err(actix_web::error::ErrorBadRequest(err)),
            };
        }
    }
    Ok(None)
}
