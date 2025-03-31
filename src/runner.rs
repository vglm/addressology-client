use crate::err_custom_create;
use crate::error::AddressologyError;
use crate::fancy::FancyDbObj;
use crate::types::DbAddress;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrunchRunnerData {
    runner_no: u64,
    device_name: Option<String>,
    total_computed: Option<f64>,
    reported_speed: Option<f64>,
    found_addresses_count: u64,
    last_updated_speed: Option<chrono::DateTime<chrono::Utc>>,
    last_address_found: Option<chrono::DateTime<chrono::Utc>>,
}

impl CrunchRunnerData {
    pub fn new(runner_no: u64) -> Self {
        Self {
            runner_no,
            device_name: None,
            total_computed: None,
            reported_speed: None,
            found_addresses_count: 0,
            last_updated_speed: None,
            last_address_found: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkTarget {
    Factory(DbAddress),
    PublicKeyBase(String),
    Default,
}


#[derive(Debug)]
pub struct CrunchRunner {
    exe_path: PathBuf,
    contract: Option<DbAddress>,
    public_key_base: Option<String>,

    is_enabled: bool,

    child_process: Arc<Mutex<Option<Child>>>,
    stdout_thread: Option<thread::JoinHandle<()>>,
    stderr_thread: Option<thread::JoinHandle<()>>,

    shared_data: Arc<Mutex<CrunchRunnerData>>,
    addresses_deque: Arc<Mutex<VecDeque<FancyDbObj>>>,

    current_target: WorkTarget,
    work_target: WorkTarget,
}

impl Drop for CrunchRunner {
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
    context: Arc<Mutex<CrunchRunnerData>>,
    address_deque: Arc<Mutex<VecDeque<FancyDbObj>>>,
) -> Result<(), AddressologyError> {
    log::trace!("Output: {}", str);
    let device_no = context.lock().runner_no;
    //log::info!("Output: {}", str);
    if str.starts_with("0x") {
        let split = str
            .split(",")
            .map(|el| el.to_string())
            .collect::<Vec<String>>();
        let factory_or_public_key_candidate = split[2].trim();
        let mut factory = None;
        let mut public_key_base = None;
        if factory_or_public_key_candidate.len() == 40
            || factory_or_public_key_candidate.len() == 42
        {
            factory = Some(
                DbAddress::from_str(factory_or_public_key_candidate)
                    .map_err(|err| err_custom_create!("Failed to parse factory address {err}"))?,
            );
        } else if factory_or_public_key_candidate.len() == 64
            || factory_or_public_key_candidate.len() == 66
        {
            public_key_base = Some(factory_or_public_key_candidate.to_string());
        }
        let fdb = FancyDbObj {
            address: DbAddress::from_str(&split[1])
                .map_err(|err| err_custom_create!("Failed to parse address {err}"))?,
            salt: split[0].to_string(),
            factory,
            public_key_base,
            created: Default::default(),
            score: 0.0,
            owner: None,
            price: 0,
            category: "".to_string(),
            job: None,
        };

        address_deque.lock().push_back(fdb);
        let mut update_context = context.lock();
        update_context.found_addresses_count += 1;
        //log::info!("Address found: {}", update_context.found_addresses_count);
        update_context.last_address_found = Some(chrono::Utc::now());
        Ok(())
    } else {
        // Extract the relevant part after "Total compute"
        if let Some(data) = str.split("Total compute ").nth(1) {
            let parts: Vec<&str> = data.split(" - ").collect();

            if parts.len() == 2 {
                let total_compute: f64 = parts[0].trim_end_matches(" GH").parse().unwrap_or(0.0);
                let rate: f64 = parts[1].trim_end_matches(" MH/s").parse().unwrap_or(0.0);

                //log::info!("Total Compute: {} GH", total_compute);
                //log::info!("Rate: {} MH/s", rate);


                let mut c = context.lock();
                c.reported_speed = Some(rate);
                c.total_computed = Some(total_compute);
                c.last_updated_speed = Some(chrono::Utc::now());
                Ok(())
            } else {
                log::warn!("Failed to parse line: {}", str);
                Err(err_custom_create!("Failed to parse line"))
            }
        } else if let Some(data) = str.split(&format!("Device {device_no}")).nth(1) {
            let mut c = context.lock();
            c.device_name = Some(data.to_string());
            Ok(())
        } else {
           // log::warn!("Unknown line {}", str);
            Ok(())
        }
    }
}

impl CrunchRunner {
    pub fn new(exe_path: PathBuf, runner_no: u64) -> Self {
        Self {
            exe_path,
            contract: None,
            public_key_base: None,
            child_process: Arc::new(Mutex::new(None)),
            stdout_thread: None,
            stderr_thread: None,
            shared_data: Arc::new(Mutex::new(CrunchRunnerData::new(runner_no))),
            addresses_deque: Arc::new(Default::default()),
            current_target: WorkTarget::Default,
            work_target: WorkTarget::Default,
            is_enabled: true,
        }
    }
    pub fn consume_results(&self, limit: usize) -> Vec<FancyDbObj> {
        let mut deque = self.addresses_deque.lock();
        let available = deque.len().min(limit); // Ensure we don't over-drain
        deque.drain(..available).collect()
    }
    pub fn is_enabled(&self) -> bool {
        self.is_enabled
    }
    pub fn is_started(&self) -> bool {
        self.child_process.lock().is_some()
    }
    pub fn shared_data(&self) -> CrunchRunnerData {
        self.shared_data.lock().clone()
    }
    pub fn reported_speed(&self) -> Option<f64> {
        self.shared_data.lock().reported_speed
    }
    pub fn total_computed(&self) -> Option<f64> {
        self.shared_data.lock().total_computed
    }
    pub fn found_addresses_count(&self) -> u64 {
        self.shared_data.lock().found_addresses_count
    }
    pub fn queue_len(&self) -> usize {
        self.addresses_deque.lock().len()
    }

    pub fn set_contract(&mut self, contract: DbAddress) {
        self.contract = Some(contract);
    }

    pub fn set_public_key_base(&mut self, public_key_base: String) {
        self.public_key_base = Some(public_key_base);
    }

    pub fn set_target(&mut self, target: WorkTarget) {
        self.work_target = target;
    }

    pub async fn restart(&mut self) -> Result<(), AddressologyError> {
        self.stop().await?;
        self.start(None).await
    }

    pub fn current_target(&self) -> WorkTarget {
        self.current_target.clone()
    }
    pub fn work_target(&self) -> WorkTarget {
        self.work_target.clone()
    }

    pub async fn enable(&mut self) -> Result<(), AddressologyError> {
        self.is_enabled = true;
        Ok(())
    }
    pub async fn disable(&mut self) -> Result<(), AddressologyError> {
        self.is_enabled = false;
        Ok(())
    }


    pub async fn start(&mut self, benchmark_time: Option<f64>) -> Result<(), AddressologyError> {
        // Spawn a process (Example: `ping` command)
        let child = self.child_process.clone();
        if self.child_process.lock().is_some() {
            return Err(err_custom_create!(
                "Cannot spawn a new process while one is already running"
            ));
        }
        self.current_target = self.work_target.clone();
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

        let mut args = {
            let work_target = self.work_target.clone();

            match work_target {
                WorkTarget::Factory(factory) => {
                    let rounds = 1000;
                    vec![
                        "-f".to_string(),
                        factory.to_string(),
                        "-r".to_string(),
                        rounds.to_string(),
                    ]
                }
                WorkTarget::PublicKeyBase(public_key_base) => {
                    let rounds = 100;
                    vec![
                        "-z".to_string(),
                        public_key_base,
                        "-r".to_string(),
                        rounds.to_string(),
                    ]
                }
                WorkTarget::Default => vec![],
            }
        };

        if let Some(benchmark_time) = benchmark_time {
            args.push("-b".to_string());
            args.push(format!("{benchmark_time}"));
        }

        log::info!(
            "Current working directory: {}",
            std::env::current_dir().unwrap().display().to_string()
        );
        log::info!("Starting process {} {}", exe_path.display().to_string(), args.join(" "));
        let exe_path_ = exe_path.clone();
        thread::spawn(move || {
            let new_child = Some(
                Command::new(&exe_path_)
                    .args(args)
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
        let stdout_deque = self.addresses_deque.clone();
        let stdout_pid = child.id();
        let child_pr = self.child_process.clone();
        let stdout_thread = thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Err(err) =
                            parse_line(line, stdout_shared_data.clone(), stdout_deque.clone())
                        {
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
        let stderr_address_deque = self.addresses_deque.clone();
        let stderr_pid = child.id();
        let stderr_thread = thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if let Err(err) = parse_line(
                            line,
                            stderr_shared_data.clone(),
                            stderr_address_deque.clone(),
                        ) {
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
        self.current_target = self.work_target.clone();
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
        self.current_target = self.work_target.clone();
        Ok(true)
    }
}

pub async fn test_run() {
    let mut crunch_runner = CrunchRunner::new(PathBuf::from("profanity_cuda.exe"), 0);
    crunch_runner.start(Some(30.4)).await.unwrap();

    let curr_time = std::time::Instant::now();
    loop {
        sleep(Duration::from_secs(1)).await;
        log::info!(
            "Reported speed: {} - addresses found {}",
            crunch_runner
                .reported_speed()
                .map(|speed| speed.to_string())
                .unwrap_or("N/A".to_string()),
            crunch_runner.found_addresses_count()
        );

        if curr_time.elapsed().as_secs() > 20 {
            break;
        }
    }
}
