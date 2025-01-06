use rustc_hex::FromHexError;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use sqlx::encode::IsNull;
use sqlx::error::BoxDynError;
use sqlx::{Database, Decode, Encode, Sqlite};
use std::fmt::Display;
use std::str::FromStr;
use web3::types::{Address, H160, U256};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DbBigInt(i128);

impl DbBigInt {
    pub fn new(val: i128) -> Self {
        Self(val)
    }

    pub fn from_u128(val: u128) -> Self {
        Self(val as i128)
    }

    pub fn from_u256(val: U256) -> Self {
        Self(val.as_u128() as i128)
    }

    #[allow(dead_code)]
    pub fn val(&self) -> i128 {
        self.0
    }

    #[allow(dead_code)]
    pub fn zero() -> Self {
        Self(0)
    }
}

impl std::convert::From<i128> for DbBigInt {
    fn from(val: i128) -> Self {
        Self::new(val)
    }
}
impl std::convert::From<u128> for DbBigInt {
    fn from(val: u128) -> Self {
        Self::from_u128(val)
    }
}
impl std::convert::From<U256> for DbBigInt {
    fn from(val: U256) -> Self {
        Self::from_u256(val)
    }
}

impl Display for DbBigInt {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl sqlx::Type<sqlx::Sqlite> for DbBigInt {
    fn type_info() -> <Sqlite as sqlx::Database>::TypeInfo {
        <String as sqlx::Type<Sqlite>>::type_info()
    }
    fn compatible(ty: &<Sqlite as sqlx::Database>::TypeInfo) -> bool {
        <String as sqlx::Type<Sqlite>>::compatible(ty)
    }
}

impl Serialize for DbBigInt {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for DbBigInt {
    fn deserialize<'a, D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        s.parse::<i128>()
            .map(DbBigInt::new)
            .map_err(serde::de::Error::custom)
    }
}

impl<'r, DB: Database> Decode<'r, DB> for DbBigInt
where
    &'r str: Decode<'r, DB>,
{
    fn decode(value: <DB as Database>::ValueRef<'r>) -> sqlx::Result<Self, BoxDynError> {
        let value: &str = Decode::decode(value)?;
        value.parse::<i128>().map(DbBigInt::new).map_err(Into::into)
    }
}

impl<'q, DB: Database> Encode<'q, DB> for DbBigInt
where
    String: sqlx::Encode<'q, DB>,
{
    fn encode_by_ref(&self, buf: &mut DB::ArgumentBuffer<'q>) -> sqlx::Result<IsNull, BoxDynError> {
        Encode::<DB>::encode(self.to_string(), buf)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct DbAddress(Address);

impl DbAddress {
    pub fn wrap(addr: Address) -> Self {
        Self(addr)
    }

    pub fn from_str(addr: &str) -> Result<Self, FromHexError> {
        Ok(Self(Address::from_str(addr)?))
    }

    pub fn from_h160(h160: H160) -> Self {
        Self(Address::from(h160))
    }

    pub fn addr(&self) -> Address {
        self.0
    }
}

impl Display for DbAddress {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:#x}", self.0)
    }
}

impl sqlx::Type<sqlx::Sqlite> for DbAddress {
    fn type_info() -> <Sqlite as sqlx::Database>::TypeInfo {
        <String as sqlx::Type<Sqlite>>::type_info()
    }
    fn compatible(ty: &<Sqlite as sqlx::Database>::TypeInfo) -> bool {
        <String as sqlx::Type<Sqlite>>::compatible(ty)
    }
}

impl<'r, DB: Database> Decode<'r, DB> for DbAddress
where
    &'r str: Decode<'r, DB>,
{
    fn decode(value: <DB as Database>::ValueRef<'r>) -> sqlx::Result<Self, BoxDynError> {
        let value: &str = Decode::decode(value)?;
        Address::from_str(value)
            .map(DbAddress::wrap)
            .map_err(Into::into)
    }
}

impl<'q, DB: Database> Encode<'q, DB> for DbAddress
where
    String: sqlx::Encode<'q, DB>,
{
    fn encode_by_ref(&self, buf: &mut DB::ArgumentBuffer<'q>) -> sqlx::Result<IsNull, BoxDynError> {
        Encode::<DB>::encode(self.to_string(), buf)
    }
}
