use crate::db::model::{FancyDbObj, FancyScore};
use crate::error::AddressologyError;
use crate::hash::compute_create3_command;
use crate::types::DbAddress;
use crate::{err_custom_create, fancy};
use web3::types::Address;

pub fn score_fancy(address: Address) -> FancyScore {
    let mut score = FancyScore {
        leading_zeroes_score: 0.0,
        leading_any_score: 0.0,
        total_score: 0.0,
        price_multiplier: 0.0,
        category: "".to_string(),
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

    let exp_score_leading_zeroes = 16.0f64.powf(leading_zeroes as f64);
    let exp_score_leading_any = 15.0 * 16.0f64.powf(leading_any as f64 - 1.0);

    let netural_price_point = 16.0f64.powf(10f64);

    let current_biggest_score = {
        score.category = "none".to_string();
        1E6
    };

    let biggest_score = if exp_score_leading_zeroes > current_biggest_score {
        score.category = "leading_zeroes".to_string();
        exp_score_leading_zeroes
    } else {
        current_biggest_score
    };

    let biggest_score = if exp_score_leading_any > biggest_score {
        score.category = "leading_any".to_string();
        exp_score_leading_any
    } else {
        biggest_score
    };

    let price_multiplier = if biggest_score <= netural_price_point {
        1.0
    } else {
        biggest_score / netural_price_point
    };

    score.total_score = biggest_score;
    score.price_multiplier = price_multiplier;
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

    let address =
        DbAddress::from_str(&address).map_err(|_| err_custom_create!("Failed to parse address"))?;

    let score = fancy::score_fancy(address.addr());

    Ok(FancyDbObj {
        address,
        salt,
        factory: DbAddress::wrap(factory),
        created: chrono::Utc::now().naive_utc(),
        score: score.total_score,
        miner: miner_censored,
        owner: None,
        price: (score.price_multiplier * 1000.0) as i32,
        category: score.category,
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
