use crate::db::model::{FancyDbObj, FancyScore};
use crate::err_custom_create;
use crate::error::AddressologyError;
use crate::hash::compute_create3_command;
use crate::types::DbAddress;
use web3::types::Address;

pub fn score_fancy(address: Address) -> FancyScore {
    let mut score = FancyScore {
        leading_zeroes_score: 0.0,
        leading_any_score: 0.0,
        total_score: 0.0,
    };

    let address_str = format!("{:#x}", address);
    let address_str = address_str.trim_start_matches("0x");
    let mut leading_zeroes = 0;
    for c in address_str.chars() {
        if c == '0' {
            leading_zeroes += 1;
        } else {
            break;
        }
    }

    let char_start = address_str.chars().next().unwrap();
    let mut leading_any = 0;
    for c in address_str.chars() {
        if c == char_start {
            leading_any += 1;
        } else {
            break;
        }
    }

    score.leading_zeroes_score = leading_zeroes as f64;
    score.leading_any_score = leading_any as f64 - 0.9_f64;

    score.total_score = score.leading_zeroes_score.max(score.leading_any_score);
    score
}

pub fn parse_fancy(
    salt: String,
    factory: Address,
    miner_unfiltered: String,
) -> Result<FancyDbObj, AddressologyError> {
    let censor = censor::Standard + censor::Zealous + censor::Sex;

    //get rid of any weird characters from miner string
    let miner_filtered = miner_unfiltered
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == '_' || *c == ' ')
        .take(20)
        .collect::<String>();

    let miner_censored = censor.censor(&miner_filtered);

    let address = compute_create3_command(&format!("{:#x}", factory), &salt)?;

    Ok(FancyDbObj {
        address: DbAddress::from_str(&address)
            .map_err(|_| err_custom_create!("Failed to parse address"))?,
        salt,
        factory: DbAddress::wrap(factory),
        created: chrono::Utc::now().naive_utc(),
        score: 0.0,
        miner: miner_censored,
        owner: None,
        price: 0,
    })
}

//test fancy

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_parse_fancy() {
        let salt = "0x9a07547b2ac4220006e585000000000000000000000000000000000000000000";
        let factory = Address::from_str("0x9E3F8eaE49E442A323EF2094f277Bf62752E6995").unwrap();
        let miner = "shitty-miner v1.0.2";

        let result = parse_fancy(salt.to_string(), factory, miner.to_string());
        assert!(result.is_ok());

        let parsed = result.unwrap();
        assert_eq!(parsed.miner, "****ty-miner v1.0.2");

        assert_eq!(
            format!("{:#x}", parsed.address.addr()),
            "0x31585b5cd5557777376822555552bb555ee18882"
        );
        println!("{:?}", parsed);
    }
}
