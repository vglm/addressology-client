mod error;
mod hash;
mod db;
mod types;
mod fancy;
mod cookie;


use crate::hash::compute_create3_command;
use crate::db::connection::create_sqlite_connection;
use crate::db::ops::insert_fancy_obj;
use actix_multipart::form::MultipartFormConfig;
use actix_session::config::CookieContentSecurity;
use actix_session::storage::CookieSessionStore;
use actix_session::{Session, SessionMiddleware};
use actix_web::cookie::SameSite;
use actix_web::{
    web, App, HttpRequest, HttpResponse, HttpResponseBuilder, HttpServer, Responder, Scope,
};
use awc::http::StatusCode;
use awc::Client;
use clap::{crate_version, Parser, Subcommand};
use sqlx::SqlitePool;
use std::collections::{BTreeSet, HashMap};
use std::env;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;
use lazy_static::lazy_static;
use serde_json::json;
use tokio::sync::Mutex;
use crate::cookie::load_key_or_create;

fn get_allowed_emails() -> Vec<String> {
    let res = env::var("ALLOWED_EMAILS")
        .unwrap_or("sieciech.czajka@golem.network".to_string())
        .split(",")
        .map(|x| x.trim().to_string())
        .collect();
    log::info!("Allowed emails loaded: {:?}", res);
    res
}

fn get_domain() -> String {
    let res = env::var("WEB_PORTAL_DOMAIN").unwrap_or("localhost".to_string());

    log::info!("Portal domain: {}", res);

    res
}

lazy_static! {
    pub static ref ALLOWED_EMAILS: Vec<String> = get_allowed_emails();
    pub static ref WEB_PORTAL_DOMAIN: String = get_domain();
    static ref PASS_SALT: String = env::var("PASS_SALT").unwrap_or("LykwVQJAcU".to_string());
    pub static ref ALLOW_CREATING_NEW_ACCOUNTS: bool = env::var("ALLOW_CREATING_NEW_ACCOUNTS")
        .map(|v| v == "true")
        .unwrap_or(false);
}


pub struct ServerData {
    pub db_connection: Arc<Mutex<SqlitePool>>,
}

pub async fn handle_greet(session: Session) -> impl Responder {
    println!("Session: {:?}", session.status());
    let describe_version = crate_version!();

    HttpResponse::Ok().json(json!({
        "message": "Hello, World!",
        "domain": *WEB_PORTAL_DOMAIN.clone(),
        "version": describe_version,
    }))
}


/// Enum that defines the available subcommands
#[derive(Subcommand)]
enum Commands {
    Test {},
    ComputeCreate3 {
        #[arg(short, long)]
        factory: String,
        #[arg(short, long)]
        salt: String,
    },
    AddFancyAddress {
        #[arg(short, long)]
        factory: String,
        #[arg(short, long)]
        salt: String,
        #[arg(short, long)]
        miner: String,
    },
    /// Start web server
    Server {
        #[arg(long, default_value = "localhost:80")]
        addr: String,

        #[arg(long)]
        threads: Option<usize>,
    },
}

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,

    #[arg(long, default_value = "addressology.sqlite")]
    db: String,
}

#[actix_rt::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    std::env::set_var(
        "RUST_LOG",
        std::env::var("RUST_LOG").unwrap_or("info".to_string()),
    );
    env_logger::init();

    let args = Cli::parse();

    let secret_key = load_key_or_create("web-portal-cookie.key");

    match args.cmd {
        Commands::Server { addr, threads } => {
            let conn = create_sqlite_connection(Some(&PathBuf::from(args.db)), None, false, true)
                .await
                .unwrap();


            HttpServer::new(move || {
                let cors = actix_cors::Cors::permissive();

                let server_data = web::Data::new(Box::new(ServerData {
                    db_connection: Arc::new(Mutex::new(conn.clone())),
                }));
                let client = web::Data::new(Client::new());
                let session_middleware =
                    SessionMiddleware::builder(CookieSessionStore::default(), secret_key.clone())
                        .cookie_secure(true)
                        .cookie_content_security(CookieContentSecurity::Private)
                        .cookie_same_site(SameSite::Strict)
                        .cookie_domain(Some(WEB_PORTAL_DOMAIN.to_string()))
                        .cookie_name("web-portal-session".to_string())
                        .build();

                let api_scope = Scope::new("/api")
                    .route("/greet", web::get().to(handle_greet));

                App::new()
                    .wrap(session_middleware)
                    .wrap(cors)
                    .app_data(server_data)
                    .app_data(client)
                    .service(api_scope)
            })
                .workers(threads.unwrap_or(std::thread::available_parallelism().unwrap().into()))
                .bind(addr)?
                .run()
                .await
        }
        Commands::ComputeCreate3 {
            factory,
            salt,
        } => {
            let result = compute_create3_command(&factory, &salt);
            match result {
                Ok(hash) => {
                    log::info!("Computed create3 hash: {}", hash);
                    println!("{}", hash);
                }
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            }
            Ok(())
        }
        Commands::AddFancyAddress {
            factory,
            salt,
            miner,
        } => {

            let conn = create_sqlite_connection(Some(&PathBuf::from(args.db)), None, false, true)
                .await
                .unwrap();


            let factory = web3::types::Address::from_str(&factory).unwrap();
            let result = match fancy::parse_fancy(salt, factory, miner) {
                Ok(fancy) => fancy,
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            };

            println!("{:?}", result);
            match insert_fancy_obj(&conn, result).await {
                Ok(_) => (),
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            }


            Ok(())
        }
        Commands::Test {} => {
            //test_command(conn).await;

            Ok(())
        }
    }
}
