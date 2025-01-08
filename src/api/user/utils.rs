use actix_web::HttpResponse;

pub enum CheckPassResponse {
    Ok,
    BadPassword(HttpResponse),
}

pub fn check_pass(pass: &str) -> CheckPassResponse {
    if !pass
        .chars()
        .all(|c| char::is_alphanumeric(c) || char::is_ascii_punctuation(&c))
    {
        return CheckPassResponse::BadPassword(
            HttpResponse::BadRequest().body("Password must contain only alphanumeric characters"),
        );
    }
    if pass.len() < 8 {
        return CheckPassResponse::BadPassword(
            HttpResponse::BadRequest().body("Password too short (at least 8 characters)"),
        );
    }
    if !pass.chars().any(char::is_uppercase) {
        return CheckPassResponse::BadPassword(
            HttpResponse::BadRequest().body("Password must contain at least one uppercase letter"),
        );
    }
    if !pass.chars().any(char::is_lowercase) {
        return CheckPassResponse::BadPassword(
            HttpResponse::BadRequest().body("Password must contain at least one lowercase letter"),
        );
    }
    if !pass.chars().any(char::is_numeric) {
        return CheckPassResponse::BadPassword(
            HttpResponse::BadRequest().body("Password must contain at least one number"),
        );
    }

    if !pass.chars().any(|c| char::is_ascii_punctuation(&c)) {
        return CheckPassResponse::BadPassword(
            HttpResponse::BadRequest().body("Password must contain at least one special character"),
        );
    }
    CheckPassResponse::Ok
}
