use crate::db::model::UserDbObj;
use actix_session::Session;
use actix_web::{HttpResponse, Responder};

pub async fn handle_logout(session: Session) -> impl Responder {
    if session.get::<UserDbObj>("user").unwrap_or(None).is_none() {
        return HttpResponse::Ok().body("Not logged in");
    }
    session.remove("user");
    HttpResponse::Ok().body("Logged out")
}
