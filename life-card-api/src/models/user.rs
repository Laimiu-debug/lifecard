use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Age range enum for user profiles
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AgeRange {
    #[serde(rename = "18-24")]
    Age18To24,
    #[serde(rename = "25-30")]
    Age25To30,
    #[serde(rename = "31-40")]
    Age31To40,
    #[serde(rename = "41-50")]
    Age41To50,
    #[serde(rename = "50+")]
    Age50Plus,
}

impl AgeRange {
    /// Convert from database string representation
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "18-24" => Some(AgeRange::Age18To24),
            "25-30" => Some(AgeRange::Age25To30),
            "31-40" => Some(AgeRange::Age31To40),
            "41-50" => Some(AgeRange::Age41To50),
            "50+" => Some(AgeRange::Age50Plus),
            _ => None,
        }
    }

    /// Convert to database string representation
    pub fn to_db_str(&self) -> &'static str {
        match self {
            AgeRange::Age18To24 => "18-24",
            AgeRange::Age25To30 => "25-30",
            AgeRange::Age31To40 => "31-40",
            AgeRange::Age41To50 => "41-50",
            AgeRange::Age50Plus => "50+",
        }
    }
}

/// Reason for coin transactions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CoinReason {
    CardCreated,
    CardExchanged,
    DailyLogin,
    ExchangePurchase,
    ExchangeRefund,
}

impl std::fmt::Display for CoinReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoinReason::CardCreated => write!(f, "card_created"),
            CoinReason::CardExchanged => write!(f, "card_exchanged"),
            CoinReason::DailyLogin => write!(f, "daily_login"),
            CoinReason::ExchangePurchase => write!(f, "exchange_purchase"),
            CoinReason::ExchangeRefund => write!(f, "exchange_refund"),
        }
    }
}

impl CoinReason {
    /// Convert from database string representation
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "card_created" => Some(CoinReason::CardCreated),
            "card_exchanged" => Some(CoinReason::CardExchanged),
            "daily_login" => Some(CoinReason::DailyLogin),
            "exchange_purchase" => Some(CoinReason::ExchangePurchase),
            "exchange_refund" => Some(CoinReason::ExchangeRefund),
            _ => None,
        }
    }
}

/// Database user entity - maps directly to the users table
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub age_range: Option<String>,
    pub location: Option<String>,
    pub coin_balance: i32,
    pub level: i32,
    pub card_count: i32,
    pub exchange_count: i32,
    pub follower_count: i32,
    pub following_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl User {
    /// Convert User to UserProfile with interest tags
    pub fn to_profile(&self, interest_tags: Vec<String>) -> UserProfile {
        UserProfile {
            id: self.id,
            email: self.email.clone(),
            nickname: self.nickname.clone(),
            avatar: self.avatar_url.clone(),
            bio: self.bio.clone(),
            age_range: self.age_range.as_ref().and_then(|s| AgeRange::from_db_str(s)),
            location: self.location.clone(),
            interest_tags,
            coin_balance: self.coin_balance,
            level: self.level,
            card_count: self.card_count,
            exchange_count: self.exchange_count,
            follower_count: self.follower_count,
            following_count: self.following_count,
            created_at: self.created_at,
        }
    }

    /// Convert User to UserSummary
    pub fn to_summary(&self) -> UserSummary {
        UserSummary {
            id: self.id,
            nickname: self.nickname.clone(),
            avatar: self.avatar_url.clone(),
            level: self.level,
        }
    }
}

/// User profile for API responses (excludes password_hash)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: Option<String>,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub age_range: Option<AgeRange>,
    pub location: Option<String>,
    pub interest_tags: Vec<String>,
    pub coin_balance: i32,
    pub level: i32,
    pub card_count: i32,
    pub exchange_count: i32,
    pub follower_count: i32,
    pub following_count: i32,
    pub created_at: DateTime<Utc>,
}

/// Minimal user info for embedding in other responses
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, FromRow)]
pub struct UserSummary {
    pub id: Uuid,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub level: i32,
}

/// Authentication result returned after login/register
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub token: String,
    pub user: UserProfile,
}

/// Data for updating user profile
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileUpdateData {
    pub nickname: Option<String>,
    pub bio: Option<String>,
    pub age_range: Option<AgeRange>,
    pub location: Option<String>,
}

/// Coin transaction record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CoinTransaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub amount: i32,
    pub reason: String,
    pub reference_id: Option<Uuid>,
    pub balance_after: i32,
    pub created_at: DateTime<Utc>,
}

/// User interest tag record
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserInterestTag {
    pub id: Uuid,
    pub user_id: Uuid,
    pub tag: String,
    pub created_at: DateTime<Utc>,
}

/// Registration request data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

/// Login request data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Request data for setting interest tags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetInterestTagsRequest {
    pub tags: Vec<String>,
}
