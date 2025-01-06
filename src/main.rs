mod cookie;
mod db;
mod error;
mod fancy;
mod hash;
mod types;
mod solc;

use std::collections::{BTreeMap, HashMap};
use crate::cookie::load_key_or_create;
use crate::db::connection::create_sqlite_connection;
use crate::db::ops::{get_by_address, insert_fancy_obj, list_all};
use crate::hash::compute_create3_command;
use crate::types::DbAddress;
use actix_session::config::CookieContentSecurity;
use actix_session::storage::CookieSessionStore;
use actix_session::{Session, SessionMiddleware};
use actix_web::cookie::SameSite;
use actix_web::{web, App, HttpRequest, HttpResponse, HttpResponseBuilder, HttpServer, Responder, Scope};
use awc::Client;
use clap::{crate_version, Parser, Subcommand};
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use std::env;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;
use actix_web::http::StatusCode;
use tokio::sync::Mutex;
use crate::solc::compile_solc;

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

pub async fn handle_list(server_data: web::Data<Box<ServerData>>) -> impl Responder {
    let conn = server_data.db_connection.lock().await;
    let list = list_all(&conn).await.unwrap();

    HttpResponse::Ok().json(list)
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AddNewData {
    pub salt: String,
    pub miner: String,
    pub factory: String,
    pub address: String,
}

pub async fn handle_fancy_new(
    server_data: web::Data<Box<ServerData>>,
    new_data: web::Json<AddNewData>,
) -> HttpResponse {
    let conn = server_data.db_connection.lock().await;
    let factory = match web3::types::Address::from_str(&new_data.factory) {
        Ok(factory) => factory,
        Err(e) => {
            log::error!("{}", e);
            return HttpResponse::BadRequest().finish();
        }
    };
    let result = match fancy::parse_fancy(new_data.salt.clone(), factory, new_data.miner.clone()) {
        Ok(fancy) => fancy,
        Err(e) => {
            log::error!("{}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    if format!("{:#x}", result.address.addr()) != new_data.address.to_lowercase() {
        log::error!(
            "Address mismatch expected: {}, got: {}",
            format!("{:#x}", result.address.addr()),
            new_data.address.to_lowercase()
        );
        return HttpResponse::BadRequest().body("Address mismatch");
    }

    println!("{:?}", result);
    match insert_fancy_obj(&conn, result).await {
        Ok(_) => return HttpResponse::Ok().body("Entry accepted"),
        Err(e) => {
            if e.to_string().contains("UNIQUE constraint failed") {
                HttpResponse::Ok().body("Already exists")
            } else {
                log::error!("{}", e);
                HttpResponse::InternalServerError().finish()
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompileData {
    pub sources: BTreeMap<String, String>,
}

pub async fn handle_compile(
    server_data: web::Data<Box<ServerData>>,
    deploy_data: web::Json<CompileData>,
) -> HttpResponse {
    let conn = server_data.db_connection.lock().await;

    log::info!("Compiling contract: {:#?}", deploy_data.sources);
    match compile_solc(deploy_data.sources.clone(), "0.8.28").await {
        Ok(res) => HttpResponse::Ok().json(res),
        Err(e) => {
            log::error!("{}", e);
            HttpResponse::InternalServerError().finish()
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeployData {
    pub address: DbAddress,
    pub network: String,
    pub bytecode: String,
}


pub async fn handle_fancy_deploy(
    server_data: web::Data<Box<ServerData>>,
    deploy_data: web::Json<DeployData>,
) -> HttpResponse {
    let conn = server_data.db_connection.lock().await;
    let fancy = match get_by_address(&conn, deploy_data.address).await {
        Ok(fancy) => fancy,
        Err(e) => {
            log::error!("{}", e);
            return HttpResponse::InternalServerError().finish();
        }
    };

    if let Some(fancy) = fancy {

        let command = "npx hardhat run deploy3Universal.ts --network holesky";
        let command = if cfg!(windows) {
            format!("cmd /C {}", command)
        } else {
            command.to_string()
        };
        let current_dir = if cfg!(windows) {
            "C:/vglm/pretzel/locker"
        } else {
            "/addressology/pretzel/locker"
        };


        let args = if cfg!(windows) {
            command.split_whitespace().collect::<Vec<&str>>()
        } else {
            vec!["/bin/bash", "-c", &command]
        };

        let env_vars = vec![
            ("ADDRESS", format!("{:#x}", fancy.address.addr())),
            ("FACTORY", format!("{:#x}", fancy.factory.addr())),
            ("SALT", fancy.salt.clone()),
            ("MINER", fancy.miner.clone()),
            ("BYTECODE", deploy_data.bytecode.clone()),
        ];

        let cmd = match tokio::process::Command::new(args[0])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .envs(env_vars)
            .current_dir(current_dir)
            .args(&args[1..])
            .spawn()
        {
            Ok(cmd) => cmd,
            Err(e) => {
                log::error!("Failed to spawn command {}", e);
                return HttpResponse::InternalServerError().finish();
            }
        };

        let output = match cmd.wait_with_output().await {
            Ok(output) => output,
            Err(e) => {
                log::error!("{}", e);
                return HttpResponse::InternalServerError().finish();
            }
        };

        if output.status.success() {
            HttpResponse::Ok().body(output.stdout)
        } else {
            log::error!(
                "Command failed: {}",
                String::from_utf8_lossy(&output.stderr)
            );
            HttpResponse::InternalServerError().finish()
        }
    } else {
        HttpResponse::NotFound().body("Address not found")
    }
    //run command
}

#[cfg(feature = "dashboard")]
#[derive(rust_embed::RustEmbed)]
#[folder = "frontend/dist"]
struct Asset;

pub async fn redirect_to_dashboard() -> impl Responder {
    {
        let target = "/dashboard/";
        log::debug!("Redirecting to endpoint: {target}");
        HttpResponse::Ok()
            .status(actix_web::http::StatusCode::PERMANENT_REDIRECT)
            .append_header((actix_web::http::header::LOCATION, target))
            .finish()
    }
}

#[allow(dead_code)]
async fn proxy(
    path: web::Path<String>,
    client: web::Data<Client>,
    request: HttpRequest,
) -> HttpResponse {
    log::info!("Proxying request to: {path}");
    let url = format!("http://localhost:5173/dashboard/{path}");

    // here we use `IntoHttpResponse` to return the request to
    // duckduckgo back to the client that called this endpoint

    let mut new_request = client.request(request.method().clone(), url);
    for (header_name, header_value) in request.headers() {
        new_request = new_request.insert_header((header_name.clone(), header_value.clone()));
    }
    match new_request.send().await {
        Ok(resp) => {
            log::info!("Response: {}", resp.status());
            let mut response = HttpResponse::build(resp.status());

            resp.headers().into_iter().for_each(|(k, v)| {
                response.insert_header((k, v));
            });

            response.streaming(resp)
        }
        Err(e) => {
            log::error!("Error: {e}");
            HttpResponseBuilder::new(StatusCode::INTERNAL_SERVER_ERROR).body(format!("Error: {e}"))
        }
    }
}
#[allow(clippy::needless_return)]
#[allow(unreachable_code)]
pub async fn dashboard_serve(
    path: web::Path<String>,
    _client: web::Data<Client>,
    _request: HttpRequest,
) -> HttpResponse {
    #[cfg(feature = "dashboard")]
    {
        let mut path = path.as_str();

        let mut compression_header = None;
        let compressions_to_check = vec![".br", ".gz", ""];

        let mut content = None;
        if path.ends_with(".gz") || path.ends_with(".br") {
            content = Asset::get(path);
        } else {
            for compression in compressions_to_check {
                let path_with_compress = format!("{}{}", path, compression);
                content = Asset::get(&path_with_compress);
                if content.is_some() {
                    if compression == ".br" {
                        compression_header = Some("br");
                    } else if compression == ".gz" {
                        compression_header = Some("gzip");
                    }
                    break;
                }
            }
            if content.is_none() && !path.contains('.') {
                path = "index.html";
                content = Asset::get(path);
            }
        }

        log::debug!("Serving frontend file: {path}");

        return match content {
            Some(content) => {
                let mut builder: HttpResponseBuilder = HttpResponseBuilder::new(StatusCode::OK);
                builder.content_type(mime_guess::from_path(path).first_or_octet_stream().as_ref());
                if let Some(compression) = compression_header {
                    builder.append_header(("Content-Encoding", compression));
                }
                builder.append_header(("Cache-Control", "public, max-age=2600000")); // 30 days
                builder.body(content.data.into_owned())
            }
            None => HttpResponse::NotFound().body("404 Not Found"),
        };
    }
    #[cfg(feature = "proxy")]
    {
        return proxy(path, _client, _request).await;
    }
    #[cfg(all(not(feature = "dashboard"), not(feature = "proxy")))]
    HttpResponse::NotFound().body(format!("404 Not Found: {}", path))
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
                    .route("/fancy/list", web::get().to(handle_list))
                    .route("/fancy/new", web::post().to(handle_fancy_new))
                    .route("/fancy/deploy", web::post().to(handle_fancy_deploy))
                    .route("/contract/compile", web::post().to(handle_compile))
                    .route("/greet", web::get().to(handle_greet));

                App::new()
                    .wrap(session_middleware)
                    .wrap(cors)
                    .app_data(server_data)
                    .app_data(client)
                    .route("/", web::get().to(redirect_to_dashboard))
                    .route("/dashboard", web::get().to(redirect_to_dashboard))
                    .route("/dashboard/{_:.*}", web::get().to(dashboard_serve))
                    .service(api_scope)
            })
            .workers(threads.unwrap_or(std::thread::available_parallelism().unwrap().into()))
            .bind(addr)?
            .run()
            .await
        }
        Commands::ComputeCreate3 { factory, salt } => {
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
            /*match compile_solc(
                "// SPDX-License-Identifier: UNLICENSED\npragma solidity ^0.8.28;\n\n// Uncomment this line to use console.log\n// import \"hardhat/console.sol\";\n\ncontract Lock {\n    uint public unlockTime;\n    address payable public owner;\n\n    event Withdrawal(uint amount, uint when);\n\n    constructor(uint _unlockTime) payable {\n        require(\n            block.timestamp < _unlockTime,\n            \"Unlock time should be in the future\"\n        );\n\n        unlockTime = _unlockTime;\n        owner = payable(msg.sender);\n    }\n\n    function withdraw() public {\n        // Uncomment this line, and the import of \"hardhat/console.sol\", to print a log in your terminal\n        // console.log(\"Unlock time is %o and block timestamp is %o\", unlockTime, block.timestamp);\n\n        require(block.timestamp >= unlockTime, \"You can't withdraw yet\");\n        require(msg.sender == owner, \"You aren't the owner\");\n\n        emit Withdrawal(address(this).balance, block.timestamp);\n\n        owner.transfer(address(this).balance);\n    }\n}\n\n",
                               "0.8.28").await {
                Ok(res) => (
                    println!("Output of compilation: {:#?}", res)
                    ),
                Err(e) => {
                    log::error!("{}", e);
                    std::process::exit(1);
                }
            }*/

            Ok(())
        }
    }
}
