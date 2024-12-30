use actix_web::cookie::Key;
use rustc_hex::{FromHex, ToHex};
use std::fs;
use std::path::Path;

fn load_key_from_file(path: &str) -> Option<Key> {
    if !Path::new(path).exists() {
        log::info!("No cookie key found - creating: {}", path);
        return None;
    }
    let Ok(str) = fs::read_to_string(path) else {
        log::error!("Error reading key from file: {}", path);
        return None;
    };
    let Ok(data) = str.from_hex::<Vec<u8>>() else {
        log::error!("Error decoding key from file: {}", path);
        return None;
    };
    match Key::try_from(data.as_slice()) {
        Ok(key) => Some(key),
        Err(e) => {
            log::error!("Error loading key from file: {}", e);
            None
        }
    }
}

pub fn load_key_or_create(path: &str) -> Key {
    match load_key_from_file(path) {
        Some(key) => key,
        None => {
            let key = Key::generate();
            let str = format!(
                "{}{}",
                key.signing().to_hex::<String>(),
                key.encryption().to_hex::<String>()
            );
            fs::write(path, str).unwrap_or_else(|_| panic!("Unable to write file {path}"));
            //reload to make sure key will load next time without error
            load_key_from_file(path).unwrap()
        }
    }
}
