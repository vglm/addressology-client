use crate::err_custom_create;
use crate::error::AddressologyError;
use crate::service::yagna::{
    TrackingResults, YagnaNetType, YagnaRunner, YagnaRunnerData, YagnaSettings,
};
use parking_lot::Mutex;
use rand::distr::Alphanumeric;
use rand::{rng, Rng};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use std::{fs, thread};
use tokio::time::sleep;

fn get_random_string(length: usize) -> String {
    rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}
/*
         ya-provider preset create --no-interactive \
           --preset-name dummy --exe-unit dummy \
           --pricing linear \
           --price num-requests=0 --price duration=0 --price gpu-sec=0
*/

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProviderCommand {
    Run,
    CreatePreset,
    ActivatePreset,
    RemoveDefault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettings {
    data_dir: String,
    payment_network: String,
    exe_unit_path: String,
    node_name: String,
    yagna_settings: YagnaSettings,
    client_api_url: String,
    unresponsive_limit_seconds: u64,
    inactivity_limit_seconds: u64,
}
/*
         DATA_DIR: provider-dir
     YAGNA_API_URL: http://127.0.0.1:19936
     GSB_URL: tcp://127.0.0.1:19935
     YA_PAYMENT_NETWORK: holesky
     EXE_UNIT_PATH: conf/ya-*.json
     YAGNA_APPKEY: p4e4rov2id2er123
     NODE_NAME: DummyNode

*/
impl ProviderSettings {
    pub fn new(data_dir: String, client_api_url: String, yagna_settings: YagnaSettings) -> Self {
        let node_name = "CrunchNode".to_string();
        let payment_network = "holesky".to_string();
        let exe_unit_path = "conf/ya-*.json".to_string();
        Self {
            data_dir,
            payment_network,
            exe_unit_path,
            node_name,
            yagna_settings,
            client_api_url,
            unresponsive_limit_seconds: 1,
            inactivity_limit_seconds: 1,
        }
    }
    pub fn to_env(&self) -> Vec<(String, String)> {
        #[rustfmt::skip]
        let mut envs = vec![
            ("DATA_DIR".to_string(), self.data_dir.clone()),
            ("YA_PAYMENT_NETWORK".to_string(), self.payment_network.clone()),
            ("EXE_UNIT_PATH".to_string(), self.exe_unit_path.clone()),
            ("NODE_NAME".to_string(), self.node_name.clone()),
            ("CRUNCHER_CLIENT_API_URL".to_string(), self.client_api_url.to_string()),
            ("UNRESPONSIVE_LIMIT_SECONDS".to_string(), self.unresponsive_limit_seconds.to_string()),
            ("INACTIVITY_LIMIT_SECONDS".to_string(), self.inactivity_limit_seconds.to_string())
        ];
        let mut yagna_envs = self.yagna_settings.to_env();
        envs.append(&mut yagna_envs);
        envs
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRunnerData {
    pub command: ProviderCommand,
    pub settings: ProviderSettings,
}

#[derive(Debug)]
pub struct ProviderRunner {
    exe_path: PathBuf,
    child_process: Arc<Mutex<Option<Child>>>,
    stdout_thread: Option<thread::JoinHandle<()>>,
    stderr_thread: Option<thread::JoinHandle<()>>,

    shared_data: Arc<Mutex<ProviderRunnerData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExeUnitInfo {
    pub activity_id: String,
    pub agreement_json: serde_json::Value,
    pub log: Option<String>,
}

impl Drop for ProviderRunner {
    fn drop(&mut self) {
        let mut child = self.child_process.lock();
        if let Some(child) = child.as_mut() {
            log::warn!("Process with pid {} still running - killing", child.id());
            let _ = child.kill();
            log::info!("Process with pid {} killed", child.id());
        }
    }
}

fn parse_line(
    str: String,
    _context: Arc<Mutex<ProviderRunnerData>>,
) -> Result<(), AddressologyError> {
    log::info!("Output: {}", str);
    Ok(())
}

impl ProviderRunner {
    pub fn new(exe_path: PathBuf, data: ProviderRunnerData) -> Self {
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

    pub async fn get_last_exe_unit_log(&self) -> Result<Option<ExeUnitInfo>, AddressologyError> {
        //get provider dir
        let provider_dir = self.shared_data.lock().settings.data_dir.clone();
        let provider_dir = PathBuf::from(provider_dir);

        let exe_unit_dir = provider_dir.join("exe-unit").join("work");

        let mut entries: Vec<(PathBuf, SystemTime)> = fs::read_dir(&exe_unit_dir)
            .map_err(|e| err_custom_create!("Failed to read directory: {}", e))?
            .filter_map(|entry| {
                entry.ok().and_then(|e| {
                    let path = e.path();
                    if path.is_dir() {
                        e.metadata()
                            .ok()
                            .and_then(|meta| meta.modified().ok().map(|time| (path, time)))
                    } else {
                        None
                    }
                })
            })
            .collect();

        // Sort by modification date (newest first)
        entries.sort_by_key(|&(_, time)| std::cmp::Reverse(time));

        // Get the newest directory, if any
        let agreement_dir = if let Some((agreement_dir, _)) = entries.first() {
            agreement_dir
        } else {
            return Ok(None);
        };

        // Get the activity ID from the directory name
        //load contents of agreement_json
        let agreement_json_path = agreement_dir.join("agreement.json");
        let agreement_json = fs::read_to_string(agreement_json_path)
            .map_err(|e| err_custom_create!("Failed to read file: {}", e))?;
        let agreement_json = serde_json::from_str(&agreement_json)
            .map_err(|e| err_custom_create!("Failed to parse JSON: {}", e))?;

        // list folders in agreement_dir

        let directories = fs::read_dir(agreement_dir)
            .map_err(|e| err_custom_create!("Failed to read directory: {}", e))?;

        let mut activity_dir = None;

        for entry in directories {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    activity_dir = Some(path);
                }
            } else {
                return Err(err_custom_create!("Failed to read entry"));
            }
        }
        let log_path = if let Some(activity_dir) = activity_dir {
            let log_path = activity_dir.join("logs");
            if log_path.exists() {
                Some(log_path)
            } else {
                None
            }
        } else {
            None
        };
        let mut log_content = None;
        if let Some(log_path) = log_path {
            for entry in fs::read_dir(&log_path)
                .map_err(|e| err_custom_create!("Failed to read directory: {}", e))?
            {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_file() && path.extension().is_some_and(|ext| ext == "log") {
                        let log_c = fs::read_to_string(path)
                            .map_err(|e| err_custom_create!("Failed to read file: {}", e))?;
                        log_content = Some(log_c);
                    }
                } else {
                    return Err(err_custom_create!("Failed to read entry"));
                }
            }
        }

        Ok(Some(ExeUnitInfo {
            activity_id: "".to_string(),
            agreement_json,
            log: log_content,
        }))
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
                ProviderCommand::Run => ["run"].to_vec(),
                ProviderCommand::CreatePreset => [
                    "preset",
                    "create",
                    "--no-interactive",
                    "--preset-name",
                    "dummy",
                    "--exe-unit",
                    "dummy",
                    "--pricing",
                    "linear",
                    "--price",
                    "tera-hash=0.01",
                    "--price",
                    "duration=0",
                ]
                .to_vec(),
                ProviderCommand::ActivatePreset => ["preset", "activate", "dummy"].to_vec(),
                ProviderCommand::RemoveDefault => ["preset", "remove", "default"].to_vec(),
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
        log::info!("Extra env args {:?}", extra_env);
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
                if let Some(_) = child.as_mut() {
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

    pub async fn join(&mut self) -> Result<bool, AddressologyError> {
        let mut child = self.child_process.lock();
        if let Some(child) = child.as_mut() {
            log::info!("Waiting for process with pid {} to finish", child.id());
            let _ = child.wait();
            log::info!("Process with pid {} finished", child.id());
        } else {
            return Ok(false);
        }
        child.take();
        Ok(true)
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

    pub async fn configure(&mut self) -> Result<(), AddressologyError> {
        if self.is_started() {
            return Err(err_custom_create!("Cannot configure a running process"));
        }
        let settings_clone = self.shared_data.lock().settings.clone();
        match configure_provider(settings_clone).await {
            Ok(_) => Ok(()),
            Err(err) => {
                log::error!("Error configuring provider: {}", err);
                Err(err)
            }
        }
    }
}

async fn configure_provider(provider_settings: ProviderSettings) -> Result<(), AddressologyError> {
    {
        let mut provider_runner = ProviderRunner::new(
            PathBuf::from("ya-provider.exe"),
            ProviderRunnerData {
                command: ProviderCommand::CreatePreset,
                settings: provider_settings.clone(),
            },
        );
        provider_runner.start().await?;
        provider_runner.join().await?;
    }
    {
        let mut provider_runner = ProviderRunner::new(
            PathBuf::from("ya-provider.exe"),
            ProviderRunnerData {
                command: ProviderCommand::ActivatePreset,
                settings: provider_settings.clone(),
            },
        );
        provider_runner.start().await?;
        provider_runner.join().await?;
    }
    {
        let mut provider_runner = ProviderRunner::new(
            PathBuf::from("ya-provider.exe"),
            ProviderRunnerData {
                command: ProviderCommand::RemoveDefault,
                settings: provider_settings.clone(),
            },
        );
        provider_runner.start().await?;
        provider_runner.join().await?;
    }
    Ok(())
}

pub async fn test_run_provider() {
    /*
             DATA_DIR: provider-dir
         YAGNA_API_URL: http://127.0.0.1:19936
         GSB_URL: tcp://127.0.0.1:19935
         YA_PAYMENT_NETWORK: holesky
         EXE_UNIT_PATH: conf/ya-*.json
         YAGNA_APPKEY: p4e4rov2id2er123
         NODE_NAME: DummyNode

    */
    let yagna_settings = YagnaSettings::new(
        "yagna-runner-test",
        24665,
        24666,
        "PPBf7M3zkrx2",
        Some(YagnaNetType::Central("polygongas.org:7999".to_string())),
    );

    let mut yagna_runner = YagnaRunner::new(
        PathBuf::from("yagna.exe"),
        YagnaRunnerData::server(yagna_settings.clone()),
        Arc::new(Mutex::new(TrackingResults {
            actvities: BTreeMap::new(),
        })),
    );
    yagna_runner.start().await.unwrap();

    sleep(Duration::from_secs(5)).await;

    let new_random_provider_dir = "provider-dir-".to_string() + &*get_random_string(10);
    let provider_settings = ProviderSettings {
        data_dir: new_random_provider_dir,
        payment_network: "holesky".to_string(),
        exe_unit_path: "conf/ya-*.json".to_string(),
        node_name: "DummyNode".to_string(),
        yagna_settings: yagna_settings.clone(),
        client_api_url: "http://127.0.0.1:181".to_string(),
        unresponsive_limit_seconds: 65,
        inactivity_limit_seconds: 60,
    };
    {
        let mut provider_runner = ProviderRunner::new(
            PathBuf::from("ya-provider.exe"),
            ProviderRunnerData {
                command: ProviderCommand::CreatePreset,
                settings: provider_settings.clone(),
            },
        );
        provider_runner.start().await.unwrap();
        provider_runner.join().await.unwrap();
    }
    {
        let mut provider_runner = ProviderRunner::new(
            PathBuf::from("ya-provider.exe"),
            ProviderRunnerData {
                command: ProviderCommand::ActivatePreset,
                settings: provider_settings.clone(),
            },
        );
        provider_runner.start().await.unwrap();
        provider_runner.join().await.unwrap();
    }
    {
        let mut provider_runner = ProviderRunner::new(
            PathBuf::from("ya-provider.exe"),
            ProviderRunnerData {
                command: ProviderCommand::RemoveDefault,
                settings: provider_settings.clone(),
            },
        );
        provider_runner.start().await.unwrap();
        provider_runner.join().await.unwrap();
    }

    let mut provider_runner = ProviderRunner::new(
        PathBuf::from("ya-provider.exe"),
        ProviderRunnerData {
            command: ProviderCommand::Run,
            settings: provider_settings.clone(),
        },
    );
    provider_runner.start().await.unwrap();

    let curr_time = std::time::Instant::now();
    loop {
        sleep(Duration::from_secs(5)).await;

        let mut payment_check = YagnaRunner::new(
            PathBuf::from("yagna.exe"),
            YagnaRunnerData::payment_status(yagna_settings.clone()),
            Arc::new(Mutex::new(TrackingResults {
                actvities: BTreeMap::new(),
            })),
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
