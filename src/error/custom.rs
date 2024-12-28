use std::error::Error;
use std::fmt::Display;

/// A custom error type for convenient error creation
#[derive(Debug)]
pub struct CustomError {
    message: String,
}

impl CustomError {
    pub fn from_owned_string(message: String) -> CustomError {
        CustomError { message }
    }
}
impl Error for CustomError {}

impl Display for CustomError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "CustomError: {}", self.message)
    }
}
