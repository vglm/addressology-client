use crate::config::{get_base_difficulty, get_base_difficulty_price};
use crate::db::model::{FancyDbObj, FancyScore};
use crate::error::AddressologyError;
use crate::hash::compute_create3_command;
use crate::types::DbAddress;
use crate::{err_custom_create, fancy};
use web3::signing::keccak256;
use web3::types::{Address, H160};

fn to_checksum(address: &H160) -> String {
    let address_str = format!("{:x}", address);
    let hash = keccak256(address_str.as_bytes());
    let mut result = "0x".to_string();

    for (i, char) in address_str.chars().enumerate() {
        if char.is_ascii_hexdigit() {
            let hash_byte = hash[i / 2];
            let is_uppercase = if i % 2 == 0 {
                hash_byte >> 4 > 7
            } else {
                (hash_byte & 0x0f) > 7
            };
            if is_uppercase {
                result.push(char.to_ascii_uppercase());
            } else {
                result.push(char);
            }
        } else {
            result.push(char);
        }
    }

    result
}

pub fn score_fancy(address: Address) -> FancyScore {
    let mut score = FancyScore::default();

    score.address_lower_case = format!("{:#x}", address).to_lowercase();
    score.address_mixed_case = to_checksum(&address);
    score.address_short_etherscan =
        score.address_mixed_case[0..10].to_string() + "..." + &score.address_mixed_case[33..42];

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

    let mut letters_only = 0;
    for c in address_str.chars() {
        if c.is_alphabetic() {
            letters_only += 1;
        }
    }

    let mut numbers_only = 0;
    for c in address_str.chars() {
        if c.is_numeric() {
            numbers_only += 1;
        }
    }

    score.leading_zeroes_score = leading_zeroes as f64;
    score.leading_any_score = leading_any as f64 - 0.9_f64;
    score.letters_only_score = letters_only as f64;

    let exp_score_leading_zeroes = 16.0f64.powf(leading_zeroes as f64);
    let exp_score_leading_any = 16.0f64.powf(leading_any as f64 - (15. / 16.));
    let exp_score_letters_only = 16.0f64.powf((letters_only - 25) as f64);
    let exp_score_numbers_only = 16.0f64.powf((numbers_only - 30) as f64);

    let neutral_price_point = get_base_difficulty();

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

    let biggest_score = if exp_score_letters_only > biggest_score {
        score.category = "letters_only".to_string();
        exp_score_letters_only
    } else {
        biggest_score
    };

    let biggest_score = if exp_score_numbers_only > biggest_score {
        score.category = "numbers_only".to_string();
        exp_score_numbers_only
    } else {
        biggest_score
    };

    let price_multiplier = if biggest_score <= neutral_price_point {
        1.0
    } else {
        biggest_score / neutral_price_point
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
        price: (score.price_multiplier * get_base_difficulty_price() as f64) as i64,
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
