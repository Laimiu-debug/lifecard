use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::user::UserSummary;

/// Card type enum - maps to PostgreSQL card_type enum
/// Requirements: 3.1
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "card_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    DayCard,      // 一天体验卡
    WeekCard,     // 一周体验卡
    FragmentCard, // 人生片段卡
    MomentCard,   // 重要时刻卡
}

impl std::fmt::Display for CardType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CardType::DayCard => write!(f, "day_card"),
            CardType::WeekCard => write!(f, "week_card"),
            CardType::FragmentCard => write!(f, "fragment_card"),
            CardType::MomentCard => write!(f, "moment_card"),
        }
    }
}

impl CardType {
    /// Convert from database string representation
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "day_card" => Some(CardType::DayCard),
            "week_card" => Some(CardType::WeekCard),
            "fragment_card" => Some(CardType::FragmentCard),
            "moment_card" => Some(CardType::MomentCard),
            _ => None,
        }
    }

    /// Convert to database string representation
    pub fn to_db_str(&self) -> &'static str {
        match self {
            CardType::DayCard => "day_card",
            CardType::WeekCard => "week_card",
            CardType::FragmentCard => "fragment_card",
            CardType::MomentCard => "moment_card",
        }
    }
}

/// Privacy level enum - maps to PostgreSQL privacy_level enum
/// Requirements: 3.7
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "privacy_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PrivacyLevel {
    Public,       // 公开
    FriendsOnly,  // 好友可见
    ExchangeOnly, // 仅交换可见
}

impl std::fmt::Display for PrivacyLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PrivacyLevel::Public => write!(f, "public"),
            PrivacyLevel::FriendsOnly => write!(f, "friends_only"),
            PrivacyLevel::ExchangeOnly => write!(f, "exchange_only"),
        }
    }
}

impl PrivacyLevel {
    /// Convert from database string representation
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "public" => Some(PrivacyLevel::Public),
            "friends_only" => Some(PrivacyLevel::FriendsOnly),
            "exchange_only" => Some(PrivacyLevel::ExchangeOnly),
            _ => None,
        }
    }

    /// Convert to database string representation
    pub fn to_db_str(&self) -> &'static str {
        match self {
            PrivacyLevel::Public => "public",
            PrivacyLevel::FriendsOnly => "friends_only",
            PrivacyLevel::ExchangeOnly => "exchange_only",
        }
    }
}

impl Default for PrivacyLevel {
    fn default() -> Self {
        PrivacyLevel::Public
    }
}

/// Media type enum for card attachments
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MediaType {
    Image,
    Video,
}

/// Media item attached to a card
/// Stored as JSONB in the database
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaItem {
    pub id: Uuid,
    pub media_type: MediaType,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<i32>,
}

impl MediaItem {
    /// Create a new image media item
    pub fn new_image(url: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            media_type: MediaType::Image,
            url,
            thumbnail_url: None,
            width: None,
            height: None,
        }
    }

    /// Create a new video media item
    pub fn new_video(url: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            media_type: MediaType::Video,
            url,
            thumbnail_url: None,
            width: None,
            height: None,
        }
    }
}

/// Location information for a card
/// Stored as JSONB in the database
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Location {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
}

impl Location {
    /// Create a new location
    pub fn new(name: String, latitude: f64, longitude: f64) -> Self {
        Self {
            name,
            latitude,
            longitude,
        }
    }

    /// Validate location coordinates
    pub fn is_valid(&self) -> bool {
        self.latitude >= -90.0 && self.latitude <= 90.0 &&
        self.longitude >= -180.0 && self.longitude <= 180.0
    }

    /// Calculate distance to another location using Haversine formula
    /// Returns distance in kilometers
    /// Requirements: 4.5
    pub fn distance_to(&self, other: &Location) -> f64 {
        const EARTH_RADIUS_KM: f64 = 6371.0;

        let lat1_rad = self.latitude.to_radians();
        let lat2_rad = other.latitude.to_radians();
        let delta_lat = (other.latitude - self.latitude).to_radians();
        let delta_lon = (other.longitude - self.longitude).to_radians();

        let a = (delta_lat / 2.0).sin().powi(2)
            + lat1_rad.cos() * lat2_rad.cos() * (delta_lon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().asin();

        EARTH_RADIUS_KM * c
    }

    /// Check if this location is within a given radius of another location
    /// Requirements: 4.5
    pub fn is_within_radius(&self, center: &Location, radius_km: f64) -> bool {
        self.distance_to(center) <= radius_km
    }
}

/// Life Card - the main card entity
/// Requirements: 3.1, 3.2
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LifeCard {
    pub id: Uuid,
    pub creator_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<UserSummary>,
    pub card_type: CardType,
    pub title: String,
    pub description: String,
    pub media: Vec<MediaItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<Location>,
    pub emotion_tags: Vec<String>,
    pub interest_tags: Vec<String>,
    pub privacy_level: PrivacyLevel,
    pub exchange_price: i32,
    pub like_count: i32,
    pub comment_count: i32,
    pub exchange_count: i32,
    #[serde(default)]
    pub is_liked: bool,
    #[serde(default)]
    pub is_collected: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Database row for cards table - maps directly to PostgreSQL
/// Used for SQLx queries
#[derive(Debug, Clone, FromRow)]
pub struct CardRow {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub card_type: CardType,
    pub title: String,
    pub description: String,
    pub media: sqlx::types::Json<Vec<MediaItem>>,
    pub location: Option<sqlx::types::Json<Location>>,
    pub emotion_tags: Vec<String>,
    pub interest_tags: Vec<String>,
    pub privacy_level: PrivacyLevel,
    pub base_price: i32,
    pub like_count: i32,
    pub comment_count: i32,
    pub exchange_count: i32,
    pub view_count: i32,
    pub hot_score: f64,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CardRow {
    /// Convert database row to LifeCard API model
    pub fn to_life_card(&self, creator: Option<UserSummary>, is_liked: bool, is_collected: bool) -> LifeCard {
        LifeCard {
            id: self.id,
            creator_id: self.creator_id,
            creator,
            card_type: self.card_type.clone(),
            title: self.title.clone(),
            description: self.description.clone(),
            media: self.media.0.clone(),
            location: self.location.as_ref().map(|l| l.0.clone()),
            emotion_tags: self.emotion_tags.clone(),
            interest_tags: self.interest_tags.clone(),
            privacy_level: self.privacy_level.clone(),
            exchange_price: self.calculate_exchange_price(),
            like_count: self.like_count,
            comment_count: self.comment_count,
            exchange_count: self.exchange_count,
            is_liked,
            is_collected,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }

    /// Calculate exchange price based on card popularity
    /// Requirements: 6.7
    pub fn calculate_exchange_price(&self) -> i32 {
        let base = self.base_price;
        // Add popularity bonus: +1 coin per 10 likes, +2 per exchange
        let popularity_bonus = (self.like_count / 10) + (self.exchange_count * 2);
        base + popularity_bonus
    }
}

/// Summary of a life card for embedding in other responses
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LifeCardSummary {
    pub id: Uuid,
    pub title: String,
    pub card_type: CardType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
}

impl From<&LifeCard> for LifeCardSummary {
    fn from(card: &LifeCard) -> Self {
        Self {
            id: card.id,
            title: card.title.clone(),
            card_type: card.card_type.clone(),
            thumbnail: card.media.first().map(|m| {
                m.thumbnail_url.clone().unwrap_or_else(|| m.url.clone())
            }),
        }
    }
}

/// Data for creating a new card
/// Requirements: 3.2
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CardCreateData {
    pub card_type: CardType,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub media: Option<Vec<MediaItem>>,
    #[serde(default)]
    pub location: Option<Location>,
    #[serde(default)]
    pub emotion_tags: Option<Vec<String>>,
    #[serde(default)]
    pub interest_tags: Option<Vec<String>>,
    #[serde(default)]
    pub privacy_level: Option<PrivacyLevel>,
}

impl CardCreateData {
    /// Validate the card creation data
    /// Requirements: 3.8
    pub fn validate(&self) -> Result<(), String> {
        // Title validation
        if self.title.trim().is_empty() {
            return Err("Title cannot be empty".to_string());
        }
        if self.title.len() > 200 {
            return Err("Title must be 200 characters or less".to_string());
        }

        // Description validation
        if self.description.trim().is_empty() {
            return Err("Description cannot be empty".to_string());
        }

        // Location validation
        if let Some(ref loc) = self.location {
            if !loc.is_valid() {
                return Err("Invalid location coordinates".to_string());
            }
        }

        // Tags validation
        if let Some(ref tags) = self.emotion_tags {
            if tags.len() > 10 {
                return Err("Maximum 10 emotion tags allowed".to_string());
            }
            for tag in tags {
                if tag.len() > 50 {
                    return Err("Each emotion tag must be 50 characters or less".to_string());
                }
            }
        }

        if let Some(ref tags) = self.interest_tags {
            if tags.len() > 10 {
                return Err("Maximum 10 interest tags allowed".to_string());
            }
            for tag in tags {
                if tag.len() > 50 {
                    return Err("Each interest tag must be 50 characters or less".to_string());
                }
            }
        }

        Ok(())
    }

    /// Calculate coin reward for card creation based on completeness
    /// Requirements: 3.10, 6.1
    pub fn calculate_creation_reward(&self) -> i32 {
        let mut reward = 5; // Base reward for creating a card

        // Bonus for having media
        if self.media.as_ref().map_or(false, |m| !m.is_empty()) {
            reward += 3;
        }

        // Bonus for having location
        if self.location.is_some() {
            reward += 2;
        }

        // Bonus for having emotion tags
        if self.emotion_tags.as_ref().map_or(false, |t| !t.is_empty()) {
            reward += 1;
        }

        // Bonus for having interest tags
        if self.interest_tags.as_ref().map_or(false, |t| !t.is_empty()) {
            reward += 1;
        }

        reward
    }
}

/// Data for updating an existing card
/// Requirements: 9.2
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CardUpdateData {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub emotion_tags: Option<Vec<String>>,
    #[serde(default)]
    pub interest_tags: Option<Vec<String>>,
    #[serde(default)]
    pub privacy_level: Option<PrivacyLevel>,
}

impl CardUpdateData {
    /// Validate the card update data
    pub fn validate(&self) -> Result<(), String> {
        // Title validation
        if let Some(ref title) = self.title {
            if title.trim().is_empty() {
                return Err("Title cannot be empty".to_string());
            }
            if title.len() > 200 {
                return Err("Title must be 200 characters or less".to_string());
            }
        }

        // Description validation
        if let Some(ref desc) = self.description {
            if desc.trim().is_empty() {
                return Err("Description cannot be empty".to_string());
            }
        }

        // Tags validation
        if let Some(ref tags) = self.emotion_tags {
            if tags.len() > 10 {
                return Err("Maximum 10 emotion tags allowed".to_string());
            }
            for tag in tags {
                if tag.len() > 50 {
                    return Err("Each emotion tag must be 50 characters or less".to_string());
                }
            }
        }

        if let Some(ref tags) = self.interest_tags {
            if tags.len() > 10 {
                return Err("Maximum 10 interest tags allowed".to_string());
            }
            for tag in tags {
                if tag.len() > 50 {
                    return Err("Each interest tag must be 50 characters or less".to_string());
                }
            }
        }

        Ok(())
    }
}

/// Search query parameters for card discovery
/// Requirements: 4.2, 4.3, 4.4, 4.5
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchQuery {
    #[serde(default)]
    pub keyword: Option<String>,
    #[serde(default)]
    pub card_type: Option<CardType>,
    #[serde(default)]
    pub interest_tags: Option<Vec<String>>,
    #[serde(default)]
    pub location: Option<LocationFilter>,
    #[serde(default)]
    pub creator_id: Option<Uuid>,
}

/// Location filter for geographic search
/// Requirements: 4.5
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LocationFilter {
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: f64,
}

impl LocationFilter {
    /// Create a new location filter
    pub fn new(latitude: f64, longitude: f64, radius_km: f64) -> Self {
        Self {
            latitude,
            longitude,
            radius_km,
        }
    }

    /// Validate the location filter
    pub fn is_valid(&self) -> bool {
        self.latitude >= -90.0 && self.latitude <= 90.0 &&
        self.longitude >= -180.0 && self.longitude <= 180.0 &&
        self.radius_km > 0.0 && self.radius_km <= 1000.0 // Max 1000km radius
    }

    /// Convert to a Location (center point)
    pub fn to_location(&self) -> Location {
        Location::new(
            format!("Search center ({:.4}, {:.4})", self.latitude, self.longitude),
            self.latitude,
            self.longitude,
        )
    }

    /// Check if a location is within this filter's radius
    /// Requirements: 4.5
    pub fn contains(&self, location: &Location) -> bool {
        let center = self.to_location();
        location.is_within_radius(&center, self.radius_km)
    }

    /// Calculate distance from filter center to a location
    /// Returns distance in kilometers
    pub fn distance_to(&self, location: &Location) -> f64 {
        let center = self.to_location();
        center.distance_to(location)
    }
}

/// Card folder for organizing collections
/// Requirements: 7.3
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, FromRow)]
pub struct CardFolder {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

/// Comment on a card
/// Requirements: 8.3
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Comment {
    pub id: Uuid,
    pub card_id: Uuid,
    pub user_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<UserSummary>,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// Database row for comments
#[derive(Debug, Clone, FromRow)]
pub struct CommentRow {
    pub id: Uuid,
    pub card_id: Uuid,
    pub user_id: Uuid,
    pub content: String,
    pub is_deleted: bool,
    pub created_at: DateTime<Utc>,
}

impl CommentRow {
    /// Convert to Comment API model
    pub fn to_comment(&self, user: Option<UserSummary>) -> Comment {
        Comment {
            id: self.id,
            card_id: self.card_id,
            user_id: self.user_id,
            user,
            content: self.content.clone(),
            created_at: self.created_at,
        }
    }
}

/// Time range for hot rankings
/// Requirements: 4.9
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimeRange {
    Day,
    Week,
    Month,
}

impl TimeRange {
    /// Convert to string representation for Redis keys
    pub fn as_str(&self) -> &'static str {
        match self {
            TimeRange::Day => "day",
            TimeRange::Week => "week",
            TimeRange::Month => "month",
        }
    }
}

impl Default for TimeRange {
    fn default() -> Self {
        TimeRange::Week
    }
}

/// Card feed result with pagination info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardFeedResult {
    pub cards: Vec<LifeCard>,
    pub has_more: bool,
    pub next_cursor: Option<String>,
}

/// Card search result with pagination info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardSearchResult {
    pub cards: Vec<LifeCard>,
    pub total_count: i64,
}

/// Card like record
#[derive(Debug, Clone, FromRow)]
pub struct CardLike {
    pub id: Uuid,
    pub card_id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
}

/// Card collection record (for collected cards through exchange)
#[derive(Debug, Clone, FromRow)]
pub struct CardCollection {
    pub id: Uuid,
    pub user_id: Uuid,
    pub card_id: Uuid,
    pub folder_id: Option<Uuid>,
    pub collected_at: DateTime<Utc>,
}
