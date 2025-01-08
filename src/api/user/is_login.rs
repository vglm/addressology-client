use crate::db::model::UserDbObj;
use actix_session::Session;
use actix_web::{HttpResponse, Responder};

pub async fn handle_is_login(session: Session) -> impl Responder {
    if let Some(usr_db_obj) = session.get::<UserDbObj>("user").unwrap_or(None) {
        HttpResponse::Ok().json(usr_db_obj)
    } else {
        HttpResponse::Unauthorized().body("Not logged in")
    }
}
