use crate::db::model::UserDbObj;
use actix_session::Session;
use lazy_static::lazy_static;

lazy_static! {
    pub static ref IGNORE_SCAN_API_LOGIN: bool = {
        let val = std::env::var("IGNORE_SCAN_API_LOGIN").unwrap_or_default();
        val == "1" || val.to_lowercase() == "true"
    };
}

pub fn login_check_fn(session: Session) -> Result<UserDbObj, actix_web::Error> {
    if let Some(user) = session.get::<UserDbObj>("user").unwrap_or(None) {
        Ok(user)
    } else {
        // User is not logged in, return an unauthorized error
        Err(actix_web::error::ErrorUnauthorized("Not logged in"))
    }
}

//macro login check
// Define the macro for login check
#[macro_export]
macro_rules! login_check {
    ($session:expr) => {
        if *IGNORE_SCAN_API_LOGIN {
            // Ignore login check
        } else if let Some(_usr_db_obj) = $session.get::<UserDbObj>("user").unwrap_or(None) {
            // User is logged in, so just proceed.
        } else {
            // User is not logged in, return an unauthorized error
            return HttpResponse::Unauthorized().body("Not logged in");
        }
    };
}

//macro login check
// Define the macro for login check
#[macro_export]
macro_rules! login_check_and_get {
    ($session:expr) => {
        if let Some(usr_db_obj) = $session.get::<UserDbObj>("user").unwrap_or(None) {
            usr_db_obj
        } else {
            // User is not logged in, return an unauthorized error
            return HttpResponse::Unauthorized().body("Not logged in");
        }
    };
}

//macro login check
// Define the macro for login check
#[macro_export]
macro_rules! get_logged_user_or_null {
    ($session:expr) => {
        if let Some(usr_db_obj) = $session.get::<UserDbObj>("user").unwrap_or(None) {
            Some(usr_db_obj)
        } else {
            None
        }
    };
}

#[macro_export]
macro_rules! normalize_address {
    ($address:expr) => {{
        use $crate::DbAddress;

        match DbAddress::from_str($address.as_str()) {
            Ok(addr) => addr,
            Err(e) => {
                log::error!("Error parsing address: {}", e);
                return HttpResponse::BadRequest().body(format!("Invalid address: {}", e));
            }
        }
    }};
}

#[macro_export]
macro_rules! parse_option_datetime {
    ($url_args:expr, $arg_name:expr) => {{
        if let Some(dt) = $url_args.get($arg_name) {
            match NaiveDateTime::parse_from_str(dt, "%Y-%m-%dT%H:%M:%S") {
                Ok(dt) => Some(Utc.from_utc_datetime(&dt)),
                Err(e) => {
                    let err_msg = format!("Error parsing URI datetime parameter {}: expected format like 2020-12-20T20:20:20", $arg_name);
                    log::error!("{} - {}", err_msg, e);
                    return HttpResponse::BadRequest().body(err_msg);
                }
            }
        } else {
            None
        }
    }};
}
