use crate::err_custom_create;
use crate::error::AddressologyError;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum YagnaCommand {
    Server,
    PaymentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum YagnaNetType {
    Central(String),
    Hybrid(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YagnaSettings {
    pub data_dir: String,
    pub api_url: String,
    pub gsb_url: String,
    pub app_key: String,
    pub net_connection: Option<YagnaNetType>,
}

impl YagnaSettings {
    pub fn new(
        data_dir: &str,
        api_port: u16,
        gsb_port: u16,
        app_key: &str,
        net_connection: Option<YagnaNetType>,
    ) -> Self {
        Self {
            data_dir: data_dir.to_string(),
            api_url: format!("http://127.0.0.1:{}", api_port),
            gsb_url: format!("tcp://127.0.0.1:{}", gsb_port),
            app_key: app_key.to_string(),
            net_connection: net_connection.clone(),
        }
    }
    pub fn to_env(&self) -> Vec<(String, String)> {
        let mut envs = vec![
            ("YAGNA_DATADIR".to_string(), self.data_dir.clone()),
            ("YAGNA_API_URL".to_string(), self.api_url.clone()),
            ("GSB_URL".to_string(), self.gsb_url.clone()),
            ("YAGNA_AUTOCONF_APPKEY".to_string(), self.app_key.clone()),
            ("YAGNA_APPKEY".to_string(), self.app_key.clone()), //technically not needed here, but useful in provider
            ("YA_CONSENT_STATS".to_string(), "allow".to_string()),
        ];
        if let Some(net_connection) = &self.net_connection {
            match net_connection {
                YagnaNetType::Central(url) => {
                    envs.push(("YA_NET_TYPE".to_string(), "central".to_string()));
                    envs.push(("CENTRAL_NET_HOST".to_string(), format!("{}", url)));
                }
                YagnaNetType::Hybrid(url) => {
                    envs.push(("YA_NET_TYPE".to_string(), "hybrid".to_string()));
                    envs.push(("YA_NET_RELAY_HOST".to_string(), format!("{}", url)));
                }
            }
        }
        envs
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YagnaRunnerData {
    pub(crate) command: YagnaCommand,
    pub(crate) settings: YagnaSettings,
}

impl YagnaRunnerData {
    pub fn server(settings: YagnaSettings) -> Self {
        Self {
            command: YagnaCommand::Server,
            settings,
        }
    }
    pub fn payment_status(settings: YagnaSettings) -> Self {
        Self {
            command: YagnaCommand::PaymentStatus,
            settings,
        }
    }
}

#[derive(Debug)]
pub struct YagnaRunner {
    exe_path: PathBuf,
    child_process: Arc<Mutex<Option<Child>>>,
    stdout_thread: Option<thread::JoinHandle<()>>,
    stderr_thread: Option<thread::JoinHandle<()>>,

    shared_data: Arc<Mutex<YagnaRunnerData>>,
}

impl Drop for YagnaRunner {
    fn drop(&mut self) {
        let mut child = self.child_process.lock();
        if let Some(child) = child.as_mut() {
            log::warn!("Process with pid {} still running - killing", child.id());
            let _ = child.kill();
            log::info!("Process with pid {} killed", child.id());
        }
    }
}

fn parse_line(str: String, _context: Arc<Mutex<YagnaRunnerData>>) -> Result<(), AddressologyError> {
    log::info!("Output: {}", str);
    Ok(())
}

impl YagnaRunner {
    pub fn new(exe_path: PathBuf, data: YagnaRunnerData) -> Self {
        Self {
            exe_path,
            child_process: Arc::new(Mutex::new(None)),
            stdout_thread: None,
            stderr_thread: None,
            shared_data: Arc::new(Mutex::new(data)),
        }
    }

    pub async fn restart(&mut self) -> Result<(), AddressologyError> {
        self.stop().await?;
        self.start().await
    }

    pub fn is_started(&self) -> bool {
        self.child_process.lock().is_some()
    }

    pub fn settings(&self) -> YagnaSettings {
        self.shared_data.lock().settings.clone()
    }

    pub async fn clean_data(&self) -> Result<(), AddressologyError> {
        if self.is_started() {
            return Err(err_custom_create!(
                "Cannot clean data while the process is running"
            ));
        }
        let data = self.shared_data.lock();
        let data_dir = data.settings.data_dir.clone();
        for file in std::fs::read_dir(data_dir.clone())
            .map_err(|e| err_custom_create!("Failed to read data directory {data_dir} {e}"))?
        {
            let file = file.map_err(|e| {
                err_custom_create!("Failed to read entry in data directory {data_dir} {e}")
            })?;
            let path = file.path();
            let is_yagna_db_file = path.file_name().ok_or_else(||
                err_custom_create!("Cannot get filename of {}", path.display()))?
                .to_string_lossy().starts_with("yagna.db");
            if path.is_file() && !is_yagna_db_file {
                std::fs::remove_file(&path)
                    .map_err(|e| err_custom_create!("Failed to remove file {path:?} {e}"))?;
            }
        }
        Ok(())
    }

    pub async fn start(&mut self) -> Result<(), AddressologyError> {
        // Spawn a process (Example: `ping` command)
        let child = self.child_process.clone();
        if self.child_process.lock().is_some() {
            return Err(err_custom_create!(
                "Cannot spawn a new process while one is already running"
            ));
        }
        let exe_path = self.exe_path.clone();

        //check if file exist
        if !exe_path.exists() {
            return Err(err_custom_create!(
                "Executable file {} does not exist",
                exe_path.display()
            ));
        }
        let exe_path = PathBuf::from(
            exe_path
                .canonicalize()
                .unwrap()
                .display()
                .to_string()
                .replace(r"\\?\", ""),
        );
        let args = {
            let lock = self.shared_data.lock();
            match lock.command {
                YagnaCommand::Server => ["service", "run"].to_vec(),
                YagnaCommand::PaymentStatus => {
                    ["payment", "status", "--network", "holesky", "--json"].to_vec()
                }
            }
        };

        log::info!(
            "Current working directory: {}",
            std::env::current_dir().unwrap().display().to_string()
        );
        log::info!(
            "Starting process {} {}",
            exe_path.display().to_string(),
            args.join(" ")
        );
        let extra_env = self.shared_data.lock().settings.to_env();
        log::info!("Extra env args: \n {}", extra_env.iter().map(|el|format!("{} {}", el.0, el.1)).collect::<Vec<String>>().join("\n"));
        let exe_path_ = exe_path.clone();
        thread::spawn(move || {
            let new_child = Some(
                Command::new(&exe_path_)
                    .args(args)
                    .envs(extra_env)
                    .stdout(Stdio::piped()) // Capture stdout
                    .stderr(Stdio::piped()) // Capture stderr
                    .spawn()
                    .expect("Failed to spawn child process"),
            );

            *child.lock() = new_child;
        });

        let child_pr = self.child_process.clone();
        loop {
            let child_pr = child_pr.clone();
            sleep(Duration::from_secs_f64(0.1)).await;
            if child_pr.lock().is_some() {
                break;
            }
        }

        let mut child_option = self.child_process.lock();
        let child = child_option.as_mut().unwrap();
        log::info!(
            "Process {} with pid: {} started",
            exe_path.display().to_string(),
            child.id()
        );
        // Get stdout and stderr pipes
        let stdout = child.stdout.take().expect("Failed to capture stdout");
        let stderr = child.stderr.take().expect("Failed to capture stderr");

        // Spawn a thread to read stdout
        let stdout_shared_data = self.shared_data.clone();
        let stdout_pid = child.id();
        let child_pr = self.child_process.clone();
        let stdout_thread = thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Err(err) = parse_line(line, stdout_shared_data.clone()) {
                            log::error!("Error parsing line: {err}");
                        }
                    }
                    Err(err) => {
                        log::error!("Error reading line: {err}");
                    }
                }
            }
            {
                let mut child = child_pr.lock();
                if child.as_mut().is_some() {
                    log::info!("Child process {stdout_pid} finished, cleaning handle");
                    let _ = child.take();
                }
            }
            log::info!("Stdout thread finished for pid {stdout_pid}");
        });

        // Spawn a thread to read stderr
        let stderr_shared_data = self.shared_data.clone();
        let stderr_pid = child.id();
        let stderr_thread = thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Err(err) = parse_line(line, stderr_shared_data.clone()) {
                            log::error!("Error parsing line: {err}");
                        }
                    }
                    Err(err) => {
                        log::error!("Error reading line: {err}");
                    }
                }
            }
            log::info!("Stderr thread finished for pid {stderr_pid}");
        });

        self.stdout_thread = Some(stdout_thread);
        self.stderr_thread = Some(stderr_thread);
        Ok(())
    }

    pub async fn stop(&mut self) -> Result<bool, AddressologyError> {
        //todo implement graceful shutdown
        let res = self.kill().await?;
        Ok(res)
    }

    pub async fn kill(&mut self) -> Result<bool, AddressologyError> {
        let mut child = self.child_process.lock();
        if let Some(child) = child.as_mut() {
            log::warn!("Process with pid {} still running - killing", child.id());
            let _ = child.kill();
            log::info!("Process with pid {} killed", child.id());
        } else {
            return Ok(false);
        }
        child.take();
        Ok(true)
    }

}


pub async fn test_run_yagna() {
    let yagna_settings = YagnaSettings::new(
        "yagna-runner-test",
        24665,
        24666,
        "PPBf7M3zkrx2",
        Some(YagnaNetType::Central("polygongas.org:7999".to_string())),
    );

    let mut yagna_runner = YagnaRunner::new(
        PathBuf::from("yagna.exe"),
        YagnaRunnerData {
            command: YagnaCommand::Server,
            settings: yagna_settings.clone(),
        },
    );
    yagna_runner.start().await.unwrap();

    let curr_time = std::time::Instant::now();
    loop {
        sleep(Duration::from_secs(1)).await;

        let mut payment_check = YagnaRunner::new(
            PathBuf::from("yagna.exe"),
            YagnaRunnerData {
                command: YagnaCommand::PaymentStatus,
                settings: yagna_settings.clone(),
            },
        );
        payment_check.start().await.unwrap();

        /*log::info!(
            "Reported speed: {} - addresses found {}",
            yagna_runner
                .reported_speed()
                .map(|speed| speed.to_string())
                .unwrap_or("N/A".to_string()),
            yagna_runner.found_addresses_count()
        );*/

        if curr_time.elapsed().as_secs() > 60 {
            break;
        }
    }
}
