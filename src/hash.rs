use crate::err_custom_create;
use crate::error::AddressologyError;

pub fn compute_create3_command(
    factory: String,
    caller: Option<String>,
    salt: String,
) -> Result<String, AddressologyError> {
    log::info!("Computing create3 for factory: {}, salt: {}", factory, salt);

    if let Some(caller) = caller {
        log::info!("Also checking for caller: {}", caller);
    }

    Ok("".to_string())
}
