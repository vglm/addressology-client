use std::fmt::Display;
use std::str::FromStr;
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use web3::types::Address;
use crate::config::get_base_difficulty;
use crate::db::model::FancyScore;
use crate::fancy::address_to_mixed_case;
use strum_macros::{EnumIter};

#[derive(Serialize, Deserialize, EnumIter, PartialEq, Eq, Debug, Clone)]
pub enum ScoreCategory {
    LeadingZeroes,
    LeadingAny,
    LettersOnly,
    NumbersOnly,
}

impl Display for ScoreCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ScoreCategory::LeadingZeroes => write!(f, "leading_zeroes"),
            ScoreCategory::LeadingAny => write!(f, "leading_any"),
            ScoreCategory::LettersOnly => write!(f, "letters_only"),
            ScoreCategory::NumbersOnly => write!(f, "numbers_only"),
        }
    }
}

impl FromStr for ScoreCategory {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "leading_zeroes" => Ok(ScoreCategory::LeadingZeroes),
            "leading_any" => Ok(ScoreCategory::LeadingAny),
            "letters_only" => Ok(ScoreCategory::LettersOnly),
            "numbers_only" => Ok(ScoreCategory::NumbersOnly),
            _ => Err(()),
        }
    }
}

pub fn score_categories() -> Vec<String> {
    ScoreCategory::iter().map(|v| v.to_string()).collect()
}

pub fn score_fancy(address: Address) -> FancyScore {
    let mut score = FancyScore::default();

    score.address_lower_case = format!("{:#x}", address).to_lowercase();
    score.address_mixed_case = address_to_mixed_case(&address);
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
