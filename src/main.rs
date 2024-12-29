mod error;
mod hash;

use crate::hash::compute_create3_command;
use actix_multipart::MultipartError;
use actix_web::HttpRequest;
use clap::{Parser, Subcommand};

/// Enum that defines the available subcommands
#[derive(Subcommand)]
enum Commands {
    Test {},
    ComputeCreate3 {
        #[arg(short, long)]
        factory: String,
        #[arg(short, long)]
        caller: Option<String>,
        #[arg(short, long)]
        salt: String,
    },
}

#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,

    #[arg(long, default_value = "web-portal.sqlite")]
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
            caller,
            salt,
        } => {
            let result = compute_create3_command(factory, salt);
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
        Commands::Test {} => {
            //test_command(conn).await;

            Ok(())
        }
    }
}
