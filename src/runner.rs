use crate::err_custom_create;
use crate::error::AddressologyError;
use crate::fancy::FancyDbObj;
use crate::types::DbAddress;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc};
use parking_lot::Mutex;
use std::thread;
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Default)]
struct CrunchRunnerData {
    total_computed: Option<f64>,
    reported_speed: Option<f64>,
    found_addresses_count: u64,
    addresses_deque: VecDeque<FancyDbObj>,
    last_updated_speed: Option<chrono::DateTime<chrono::Utc>>,
    last_address_found: Option<chrono::DateTime<chrono::Utc>>,
}


pub struct CrunchRunner {
    exe_path: PathBuf,
    contract: Option<DbAddress>,
    public_key_base: Option<String>,

    child_process: Arc<Mutex<Option<Child>>>,
    stdout_thread: Option<thread::JoinHandle<()>>,
    stderr_thread: Option<thread::JoinHandle<()>>,

    shared_data: Arc<Mutex<CrunchRunnerData>>,
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


fn parse_line(str: String, context: Arc<Mutex<CrunchRunnerData>>) -> Result<(), AddressologyError> {
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

        let mut update_context = context.lock();
        update_context.addresses_deque.push_back(fdb);
        update_context.found_addresses_count += 1;
        update_context.last_address_found = Some(chrono::Utc::now());
    }


    Ok(())
}

impl CrunchRunner {
    pub fn new(exe_path: PathBuf) -> Self {
        Self {
            exe_path,
            contract: None,
            public_key_base: None,
            child_process: Arc::new(Mutex::new(None)),
            stdout_thread: None,
            stderr_thread: None,
            shared_data: Arc::new(Mutex::new(CrunchRunnerData::default())),
        }
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
        self.shared_data.lock().addresses_deque.len()
    }

    pub fn set_contract(&mut self, contract: DbAddress) {
        self.contract = Some(contract);
    }

    pub fn set_public_key_base(&mut self, public_key_base: String) {
        self.public_key_base = Some(public_key_base);
    }

    pub async fn run(&mut self) -> Result<(), AddressologyError> {
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

        log::info!(
            "Current working directory: {}",
            std::env::current_dir().unwrap().display().to_string()
        );
        log::info!("Starting process {}", exe_path.display().to_string());
        let exe_path_ = exe_path.clone();
        thread::spawn(move || {
            let new_child = Some(
                Command::new(&exe_path_)
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
        });

        // Spawn a thread to read stderr
        let stderr_shared_data = self.shared_data.clone();
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
        });

        self.stdout_thread = Some(stdout_thread);
        self.stderr_thread = Some(stderr_thread);
        Ok(())
    }
}

pub async fn test_run() {
    let mut crunch_runner = CrunchRunner::new(PathBuf::from("profanity_cuda.exe"));
    crunch_runner.run().await.unwrap();

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
