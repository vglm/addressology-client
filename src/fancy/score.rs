use crate::config::get_base_difficulty;
use crate::db::model::{FancyScore, FancyScoreEntry};
use crate::fancy::address_to_mixed_case;
use serde::{Deserialize, Serialize};
use std::fmt::Display;
use std::str::FromStr;
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use web3::types::Address;

#[derive(Serialize, Deserialize, EnumIter, PartialEq, Eq, Debug, Clone, Default)]
pub enum FancyScoreCategory {
    LeadingZeroes,
    LeadingAny,
    LettersOnly,
    NumbersOnly,
    #[default]
    Random,
}

impl Display for FancyScoreCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FancyScoreCategory::LeadingZeroes => write!(f, "leading_zeroes"),
            FancyScoreCategory::LeadingAny => write!(f, "leading_any"),
            FancyScoreCategory::LettersOnly => write!(f, "letters_only"),
            FancyScoreCategory::NumbersOnly => write!(f, "numbers_only"),
            FancyScoreCategory::Random => write!(f, "random"),
        }
    }
}

impl FromStr for FancyScoreCategory {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "leading_zeroes" => Ok(FancyScoreCategory::LeadingZeroes),
            "leading_any" => Ok(FancyScoreCategory::LeadingAny),
            "letters_only" => Ok(FancyScoreCategory::LettersOnly),
            "numbers_only" => Ok(FancyScoreCategory::NumbersOnly),
            "random" => Ok(FancyScoreCategory::Random),
            _ => Err(()),
        }
    }
}

#[derive(Serialize, Deserialize, PartialEq, Debug, Clone, Default)]
pub struct FancyCategoryInfo {
    pub key: String,
    pub name: String,
    pub description: String,
}

pub fn list_score_categories() -> Vec<FancyCategoryInfo> {
    let mut categories = Vec::new();

    for category in FancyScoreCategory::iter() {
        match category {
            FancyScoreCategory::LeadingZeroes => categories.push(FancyCategoryInfo {
                key: category.to_string(),
                name: "Leading Zeroes".to_string(),
                description: "The number of leading zeroes in the address.".to_string(),
            }),
            FancyScoreCategory::LeadingAny => categories.push(FancyCategoryInfo {
                key: category.to_string(),
                name: "Leading Any".to_string(),
                description: "The number of leading characters that are the same.".to_string(),
            }),
            FancyScoreCategory::LettersOnly => categories.push(FancyCategoryInfo {
                key: category.to_string(),
                name: "Letters Only".to_string(),
                description: "The number of letters in the address.".to_string(),
            }),
            FancyScoreCategory::NumbersOnly => categories.push(FancyCategoryInfo {
                key: category.to_string(),
                name: "Numbers Only".to_string(),
                description: "The number of numbers in the address.".to_string(),
            }),
            FancyScoreCategory::Random => categories.push(FancyCategoryInfo {
                key: category.to_string(),
                name: "Random".to_string(),
                description: "Randomness of the address.".to_string(),
            }),
        }
    }
    categories
}

#[allow(clippy::vec_init_then_push)]
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

    let mut score_entries = Vec::new();

    score_entries.push(FancyScoreEntry {
        category: FancyScoreCategory::Random,
        score: 1.0f64,
        difficulty: 1000.0f64,
    });

    score_entries.push(FancyScoreEntry {
        category: FancyScoreCategory::LeadingZeroes,
        score: leading_zeroes as f64,
        difficulty: 16.0f64.powf(leading_zeroes as f64),
    });

    score_entries.push(FancyScoreEntry {
        category: FancyScoreCategory::LeadingAny,
        score: leading_any as f64 - 0.9_f64,
        difficulty: 16.0f64.powf(leading_any as f64 - (15. / 16.)),
    });

    score_entries.push(FancyScoreEntry {
        category: FancyScoreCategory::LettersOnly,
        score: letters_only as f64,
        difficulty: 16.0f64.powf((letters_only - 25) as f64),
    });

    score_entries.push(FancyScoreEntry {
        category: FancyScoreCategory::NumbersOnly,
        score: numbers_only as f64,
        difficulty: 16.0f64.powf((numbers_only - 30) as f64),
    });
    score.scores = score_entries
        .iter()
        .map(|entry| (entry.category.to_string(), entry.clone()))
        .collect();

    let neutral_price_point = get_base_difficulty();

    // This simple method is better than iterator, because of float NaN issues
    let mut biggest_score = score_entries[0].clone();
    for entry in score_entries.iter() {
        if entry.difficulty > biggest_score.difficulty {
            biggest_score = entry.clone();
        }
    }

    let biggest_score_difficulty = biggest_score.difficulty;

    let price_multiplier = if biggest_score_difficulty <= neutral_price_point {
        1.0
    } else {
        biggest_score_difficulty / neutral_price_point
    };

    score.total_score = biggest_score_difficulty;
    score.price_multiplier = price_multiplier;
    score.category = biggest_score.category.to_string();
    score
}
