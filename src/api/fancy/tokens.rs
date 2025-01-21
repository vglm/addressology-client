use crate::db::model::UserDbObj;
use crate::{login_check_and_get, ServerData};
use actix_session::Session;
use actix_web::web::Data;
use actix_web::HttpResponse;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
struct UserTokensResp {
    uid: String,
    email: String,
    tokens: i64,
}

pub async fn handle_get_user_tokens(
    _data: Data<Box<ServerData>>,
    session: Session,
) -> HttpResponse {
    let user: UserDbObj = login_check_and_get!(session);

    HttpResponse::Ok().json(UserTokensResp {
        uid: user.uid,
        email: user.email,
        tokens: user.tokens,
    })
}
