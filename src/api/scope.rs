
use actix_web::web::{get, post};
use actix_web::Scope;

#[rustfmt::skip]
pub fn server_api_scope() -> Scope {
    Scope::new("/api")

}
