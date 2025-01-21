use actix_web::{web, HttpResponse};
use crate::fancy::score_fancy;
use crate::normalize_address;

//this request can be public
pub async fn handle_score_custom(address: web::Path<String>) -> HttpResponse {
    let address = normalize_address!(address.into_inner());

    let score = score_fancy(address.addr());

    HttpResponse::Ok().json(score)
}


pub async fn handle_get_score_categories() -> HttpResponse {
    let categories = vec![
        "leading_any",
        "letters_only",
        "numbers_only",
    ];

    HttpResponse::Ok().json(categories)
}