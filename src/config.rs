use rand::distr::Alphanumeric;
use rand::{rng, Rng};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::str::FromStr;
use std::sync::OnceLock;

static CONFIG: OnceLock<Option<ApplicationConfig>> = OnceLock::new();

fn get_random_string(length: usize) -> String {
    rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}
pub fn initialize_config() {
    let config = ApplicationConfig::load_conf();

    CONFIG
        .set(Some(config))
        .expect("Config can only be set once");
}
pub fn get_config() -> &'static ApplicationConfig {
    CONFIG
        .get()
        .expect("Config not initialized")
        .as_ref()
        .expect("Config not initialized")
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "kebab-case")]
pub struct ApplicationConfig {
    pub yagna_path: String,
    pub yagna_dir: String,
    pub provider_dir: String,
    pub app_key: String,
    pub yagna_port_http: u16,
    pub yagna_port_gsb: u16,
    pub plugin_dir: String,
    pub start_automatically: bool,
    pub price_automatically: bool,
    pub auto_update: bool,
    pub central_net_host: Option<String>,
}

impl Default for ApplicationConfig {
    fn default() -> Self {
        ApplicationConfig {
            yagna_path: "yagna.exe".to_string(),
            yagna_dir: "yagna-dir".to_string(),
            provider_dir: "provider-dir".to_string(),
            app_key: get_random_string(20),
            yagna_port_http: 27480,
            yagna_port_gsb: 27481,
            plugin_dir: "conf/ya-*.json".to_string(),
            start_automatically: false,
            price_automatically: false,
            auto_update: false,
            central_net_host: Some("polygongas.org:7999".to_string()),
        }
    }
}

impl ApplicationConfig {
    pub fn save_to_toml(&self) {
        let config = toml::to_string(self).expect("Failed to serialize config");

        let config_file_path = env::var("CONFIG_CLIENT_PATH").unwrap_or("config.toml".to_string());
        // Check if the file exists and read its content
        if let Ok(mut file) = File::open(config_file_path) {
            let mut existing_content = String::new();
            file.read_to_string(&mut existing_content)
                .expect("Failed to read config file");

            // If the existing content is the same, do nothing
            if existing_content == config {
                return;
            }
        }

        // Write only if different
        let mut file = File::create("config.toml").expect("Failed to create config file");
        file.write_all(config.as_bytes())
            .expect("Failed to write config file");
    }

    pub fn load_conf() -> ApplicationConfig {
        let config_file_path = env::var("CONFIG_CLIENT_PATH").unwrap_or("config.toml".to_string());
        let mut file = File::open(&config_file_path);
        let config = match file.as_mut() {
            Ok(file) => {
                let mut str: String = String::new();
                file.read_to_string(&mut str)
                    .expect("Config file has to be readable");
                let config: ApplicationConfig = toml::de::from_str::<ApplicationConfig>(&str)
                    .unwrap_or(ApplicationConfig::default());
                config
            }
            Err(_) => {
                let default_config = ApplicationConfig::default();
                default_config.save_to_toml();
                default_config
            }
        };
        config.save_to_toml();
        config
    }
}

fn get_env_int(key: &str, default: i64) -> i64 {
    env::var(key)
        .map(|s| i64::from_str(&s).unwrap())
        .unwrap_or(default)
}

fn get_env_float(key: &str, default: f64) -> f64 {
    env::var(key)
        .map(|s| f64::from_str(&s).unwrap())
        .unwrap_or(default)
}

pub fn get_base_difficulty() -> f64 {
    get_env_float("BASE_DIFFICULTY", 16.0f64.powf(9f64))
}

pub fn get_base_difficulty_price() -> i64 {
    get_env_int("BASE_DIFFICULTY_PRICE", 1000)
}
