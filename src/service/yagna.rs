use crate::err_custom_create;
use crate::error::AddressologyError;
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use parking_lot::Mutex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, VecDeque};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::time;
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

pub struct YagnaActivityTracker {}

#[derive(Debug)]
pub struct YagnaRunner {
    exe_path: PathBuf,
    child_process: Arc<Mutex<Option<Child>>>,
    stdout_thread: Option<thread::JoinHandle<()>>,
    stderr_thread: Option<thread::JoinHandle<()>>,

    shared_data: Arc<Mutex<YagnaRunnerData>>,
    activity_tracker_handle: Option<tokio::task::JoinHandle<()>>,
    activity_tracker_results: Arc<parking_lot::Mutex<TrackingResults>>,
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
    if str.contains("actix_web::middleware::logger") {
        return Ok(());
    }
    log::info!("Output: {}", str);
    Ok(())
}

impl YagnaRunner {
    pub fn new(
        exe_path: PathBuf,
        data: YagnaRunnerData,
        activity_tracker_results: Arc<Mutex<TrackingResults>>,
    ) -> Self {
        Self {
            exe_path,
            child_process: Arc::new(Mutex::new(None)),
            stdout_thread: None,
            stderr_thread: None,
            shared_data: Arc::new(Mutex::new(data)),
            activity_tracker_handle: None,
            activity_tracker_results,
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
            let is_yagna_db_file = path
                .file_name()
                .ok_or_else(|| err_custom_create!("Cannot get filename of {}", path.display()))?
                .to_string_lossy()
                .starts_with("yagna.db");
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
        if let Some(tracker) = self.activity_tracker_handle.take() {
            tracker.abort();
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
        log::info!(
            "Extra env args: \n {}",
            extra_env
                .iter()
                .map(|el| format!("{} {}", el.0, el.1))
                .collect::<Vec<String>>()
                .join("\n")
        );
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

        drop(child_option);
        self.start_track_activities();
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

    fn start_track_activities(&mut self) {
        if self.activity_tracker_handle.is_none() {
            let settings = self.shared_data.lock().settings.clone();
            self.activity_tracker_handle = Some(tokio::spawn(tracker_loop(
                settings.api_url,
                settings.app_key,
                self.activity_tracker_results.clone(),
            )));
        } else {
            log::error!("Tracker already running");
        }
    }
}

#[derive(
    Clone, Default, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize,
)]
pub enum State {
    #[default]
    New,
    Initialized,
    Deployed,
    Ready,
    Terminated,
    Unresponsive,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityStateModel {
    id: String,
    state: State,
    #[serde(skip_serializing_if = "Option::is_none")]
    usage: Option<BTreeMap<String, f64>>,
    exe_unit: Option<String>,
    agreement_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TrackingEvent {
    ts: DateTime<Utc>,
    activities: Vec<ActivityStateModel>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UsageHistory {
    ts: DateTime<Utc>,
    usage: f64,
}

const MAX_USAGE_HISTORY: usize = 10;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ActivityEntry {
    last_update: DateTime<Utc>,
    activity: ActivityStateModel,
    usage_vector_history: VecDeque<UsageHistory>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TrackingResults {
    pub actvities: BTreeMap<String, ActivityEntry>,
}

async fn tracker_loop(
    base_url: String,
    app_key: String,
    tracking_results: Arc<Mutex<TrackingResults>>,
) {
    let url = base_url + "/activity-api/v1/_monitor";
    log::info!("Activity tracker started for url: {}", url);

    //give yagna some extra time to start
    sleep(Duration::from_secs_f64(5.0)).await;

    let client = Client::default();
    let try_again_after_error_secs = 5.0;

    loop {
        let mut long_poll_req = loop {
            time::sleep(Duration::from_secs_f64(try_again_after_error_secs)).await;
            match client
                .get(&url)
                .header("Authorization", format!("Bearer {}", app_key))
                .send()
                .await
            {
                Ok(resp) => {
                    log::info!(
                        "Connection to activity tracker established url:{url}, status: {}",
                        resp.status()
                    );
                    break resp.bytes_stream();
                }
                Err(e) => {
                    log::error!("Long polling request failed on url {url}: {e}. Trying again in {try_again_after_error_secs}s");
                }
            };
        };
        while let Some(chunk) = long_poll_req.next().await {
            match chunk {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        if text.contains("Missing application key") {
                            log::error!("Missing application key in activity tracker response. Trying again after {try_again_after_error_secs}s");
                            break;
                        }
                        //try to deserialize json
                        let text = text.strip_prefix("data: ").unwrap_or(text).trim();
                        if text.starts_with("{") && text.ends_with("}") {
                            let event: TrackingEvent = match serde_json::from_str(text) {
                                Ok(event) => event,
                                Err(e) => {
                                    log::warn!(
                                        "Error while deserializing activity tracker response: {e}"
                                    );
                                    continue;
                                }
                            };
                            if event.activities.is_empty() {
                                log::warn!("Received empty activity tracker event");
                                continue;
                            }
                            if event.activities.len() > 1 {
                                log::warn!(
                                    "Received multiple activity tracker events: {:?}",
                                    event.activities
                                );
                                continue;
                            }
                            let activity = event.activities[0].clone();

                            log::info!("Received activity tracker event: {:?}", activity);
                            let mut tracking_results = tracking_results.lock();

                            let usage_value = activity
                                .usage
                                .as_ref()
                                .and_then(|g| g.get("golem.usage.tera-hash").copied());

                            if let Some(entry) = tracking_results.actvities.get_mut(&activity.id) {
                                entry.activity = activity.clone();
                                entry.last_update = event.ts;

                                if usage_value.is_none() {
                                    log::warn!("No usage value for activity {}", activity.id);
                                } else {
                                    let usage_value = usage_value.unwrap();
                                    if usage_value >= 0.0 {
                                        if entry.usage_vector_history.len() > MAX_USAGE_HISTORY {
                                            entry.usage_vector_history.pop_back();
                                        }
                                        entry.usage_vector_history.push_front(UsageHistory {
                                            ts: event.ts,
                                            usage: usage_value,
                                        });
                                    } else {
                                        log::warn!(
                                            "Received negative usage value for activity {}",
                                            activity.id
                                        );
                                    }
                                }
                            } else {
                                tracking_results.actvities.insert(
                                    activity.id.clone(),
                                    ActivityEntry {
                                        last_update: event.ts,
                                        activity: activity.clone(),
                                        usage_vector_history: VecDeque::from(vec![UsageHistory {
                                            ts: event.ts,
                                            usage: usage_value.unwrap_or(-1.0),
                                        }]),
                                    },
                                );
                            }
                        } else {
                            log::warn!(
                                "Received non-json response from activity tracker: {}",
                                text
                            );
                        }
                    }
                }
                Err(e) => {
                    log::error!("Error while reading stream: {}. Disconnecting and trying again after {try_again_after_error_secs}s", e);
                    break;
                }
            }
        }
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
        Arc::new(Mutex::new(TrackingResults {
            actvities: BTreeMap::new(),
        })),
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
