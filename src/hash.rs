use crate::err_custom_create;
use crate::error::AddressologyError;
use secp256k1::{PublicKey, Secp256k1};
use tiny_keccak::{Hasher, Keccak};
pub fn salt_to_guarded_salt(salt: &[u8]) -> [u8; 32] {
    //take last 32 bytes
    let mut result = [0; 32];
    result.copy_from_slice(&salt[0..32]);
    result
}

pub fn compute_create3_command(factory: &str, salt: &str) -> Result<String, AddressologyError> {
    log::info!("Computing create3 for factory: {}, salt: {}", factory, salt);

    /*if let Some(caller) = &caller {
        log::info!("Also checking for caller: {}", caller);
    }*/

    /*
    let caller_bytes = if let Some(caller) = &caller {
        match hex::decode(caller.replace("0x", "")) {
            Ok(bytes) => Some(bytes),
            Err(e) => {
                return Err(err_custom_create!("Failed to decode caller: {}", e));
            }
        }
    } else {
        None
    };*/

    let factory_bytes = match hex::decode(factory.replace("0x", "")) {
        Ok(bytes) => bytes,
        Err(e) => {
            return Err(err_custom_create!("Failed to decode factory: {}", e));
        }
    };
    //hex to bytes
    let salt_bytes = match hex::decode(salt.replace("0x", "")) {
        Ok(bytes) => bytes,
        Err(e) => {
            return Err(err_custom_create!("Failed to decode salt: {}", e));
        }
    };

    if factory_bytes.len() != 20 {
        return Err(err_custom_create!(
            "Factory len has to be 20 bytes (40 characters)"
        ));
    }
    if salt_bytes.len() != 32 {
        return Err(err_custom_create!(
            "Salt len has to be 32 bytes (64 characters)"
        ));
    }
    let guarded_hash_bytes = salt_to_guarded_salt(&salt_bytes);

    println!("Guarded hash: 0x{}", hex::encode(guarded_hash_bytes));

    let mut mem = Vec::new();

    mem.extend_from_slice(&[0; 12]);
    mem[0xb] = 0xff;

    mem.extend_from_slice(&factory_bytes);

    //at this point mem should have length

    mem.extend_from_slice(&guarded_hash_bytes[0..0x20]);

    let const_hex = "0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f";
    let const_bytes = match hex::decode(const_hex.replace("0x", "")) {
        Ok(bytes) => bytes,
        Err(e) => {
            return Err(err_custom_create!("Failed to decode const: {}", e));
        }
    };
    mem.extend_from_slice(&const_bytes);

    assert_eq!(mem.len(), 96);
    assert_eq!(mem.len(), 0xb + 0x55);

    // keccak last 0x55 bytes

    let mut hasher = tiny_keccak::Keccak::v256();
    hasher.update(&mem[0xb..]);
    let mut result = [0; 32];
    hasher.finalize(&mut result);

    println!("0x{}", hex::encode(result));
    //result goes to 0x14 bytes
    //copy result into 0x14 mem location

    mem.as_mut_slice()[0x14..0x14 + 0x20].copy_from_slice(&result);

    println!("0x{}", hex::encode(mem.as_slice()));

    mem[0x1e] = 0xd6;
    mem[0x1f] = 0x94;
    mem[0x34] = 0x01;
    let mut hasher = tiny_keccak::Keccak::v256();
    hasher.update(&mem[0x1e..(0x1e + 0x17)]);
    let mut result = [0; 32];
    hasher.finalize(&mut result);

    Ok(format!("0x{}", hex::encode(&result.as_slice()[12..])))
}

pub fn compute_address_command(
    public_key_base: &str,
    private_key_add: &str,
) -> Result<String, AddressologyError> {
    let public_key_bytes =
        match hex::decode("04".to_string() + public_key_base.trim_start_matches("0x")) {
            Ok(bytes) => bytes,
            Err(e) => {
                return Err(err_custom_create!("Failed to decode public key: {}", e));
            }
        };
    let public_key_add = match PublicKey::from_slice(&public_key_bytes) {
        Ok(public_key) => public_key,
        Err(e) => {
            return Err(err_custom_create!("Failed to decode public key: {}", e));
        }
    };

    let secp = Secp256k1::new();
    let private_key_bytes = match hex::decode(private_key_add.trim_start_matches("0x")) {
        Ok(bytes) => bytes,
        Err(e) => {
            return Err(err_custom_create!("Failed to decode private key: {}", e));
        }
    };

    let private_key = match secp256k1::SecretKey::from_slice(&private_key_bytes) {
        Ok(private_key) => private_key,
        Err(e) => {
            return Err(err_custom_create!("Failed to decode private key: {}", e));
        }
    };
    let public_key = PublicKey::from_secret_key(&secp, &private_key);

    let public_key_sum_uncompressed = match public_key.combine(&public_key_add) {
        Ok(public_key_sum) => public_key_sum,
        Err(e) => {
            return Err(err_custom_create!("Failed to combine public keys: {}", e));
        }
    }
    .serialize_uncompressed();

    // Remove the first byte (0x04) to get the raw public key (64 bytes)
    let raw_public_key = &public_key_sum_uncompressed[1..];
    let mut hasher = Keccak::v256();
    hasher.update(raw_public_key);
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);

    Ok(format!("0x{}", hex::encode(&hash[12..])))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_compute_address_command() {
        env::set_var("RUST_LOG", "debug");
        env_logger::init();
        let public_key_base = "0xa71f7ec030f9ad20f8cc67fd116eb75c2117e90e649cdf293d655dc34d4b15e9fe66dfd3b79a74bf2ee878148922a34a5db044dd091731aba2404a207e2b5a05".to_string();
        let private_key_add =
            "0x04b7ae1bbb6c98775b62d9fb8e68ff05630f3b6fd7068dccce504dac9cb64f47".to_string();

        let result = compute_address_command(&public_key_base, &private_key_add);
        assert!(result.is_ok());
        assert_eq!(
            result.unwrap(),
            "0x7C92B1e0ea075Aa010A0b464764d25665221f666".to_lowercase()
        );
    }

    #[test]
    fn test_compute_create3_command() {
        let factory = "0x9E3F8eaE49E442A323EF2094f277Bf62752E6995".to_string();
        let salt = "0x9a07547b2ac4220006e585000000000000000000000000000000000000000000".to_string();

        let result = compute_create3_command(&factory, &salt);
        assert!(result.is_ok());
        assert_eq!(
            result.unwrap(),
            "0x31585b5cd5557777376822555552bb555ee18882".to_string()
        );
    }
}
