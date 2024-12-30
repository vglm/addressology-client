mod error;
mod hash;
mod db;
mod types;
mod fancy;

use std::path::PathBuf;
use std::str::FromStr;
use crate::hash::compute_create3_command;
use actix_multipart::MultipartError;
use actix_web::HttpRequest;
use clap::{Parser, Subcommand};
use crate::db::connection::create_sqlite_connection;
use crate::db::ops::insert_fancy_obj;

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


    match args.cmd {
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
