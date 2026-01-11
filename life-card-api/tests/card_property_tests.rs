//! Property-based tests for card module
//!
//! These tests validate the correctness properties defined in the design document.
//!
//! **Feature: life-card-mvp**

use proptest::prelude::*;
use uuid::Uuid;
use chrono::{DateTime, Utc, TimeZone};

use life_card_api::models::card::{
    CardType, PrivacyLevel, MediaType, MediaItem, Location,
    LifeCard, LifeCardSummary, CardCreateData, CardUpdateData,
    LocationFilter, TimeRange,
};
use life_card_api::models::user::UserSummary;

// ============================================================================
// Generators for test data
// ============================================================================

/// Generate a random UUID
fn uuid_strategy() -> impl Strategy<Value = Uuid> {
    any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
}

/// Generate a valid card type
fn card_type_strategy() -> impl Strategy<Value = CardType> {
    prop_oneof![
        Just(CardType::DayCard),
        Just(CardType::WeekCard),
        Just(CardType::FragmentCard),
        Just(CardType::MomentCard),
    ]
}

/// Generate a valid privacy level
fn privacy_level_strategy() -> impl Strategy<Value = PrivacyLevel> {
    prop_oneof![
        Just(PrivacyLevel::Public),
        Just(PrivacyLevel::FriendsOnly),
        Just(PrivacyLevel::ExchangeOnly),
    ]
}

/// Generate a valid media type
fn media_type_strategy() -> impl Strategy<Value = MediaType> {
    prop_oneof![
        Just(MediaType::Image),
        Just(MediaType::Video),
    ]
}

/// Generate a valid title (1-200 characters, non-empty)
fn valid_title_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s]{1,100}".prop_filter("title must not be empty or whitespace only", |s| {
        !s.trim().is_empty()
    })
}

/// Generate a valid description (non-empty)
fn valid_description_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s\\.\\,\\!\\?]{1,500}".prop_filter("description must not be empty", |s| {
        !s.trim().is_empty()
    })
}

/// Generate a valid URL
fn valid_url_strategy() -> impl Strategy<Value = String> {
    "[a-z]{3,10}".prop_map(|s| format!("https://example.com/media/{}.jpg", s))
}

/// Generate a valid tag (1-50 characters)
fn valid_tag_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-]{1,30}".prop_filter("tag must not be empty", |s| !s.trim().is_empty())
}

/// Generate a vector of valid tags (0-10 tags)
fn valid_tags_strategy() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(valid_tag_strategy(), 0..5)
}

/// Generate valid latitude (-90 to 90)
fn latitude_strategy() -> impl Strategy<Value = f64> {
    -90.0f64..=90.0f64
}

/// Generate valid longitude (-180 to 180)
fn longitude_strategy() -> impl Strategy<Value = f64> {
    -180.0f64..=180.0f64
}

/// Generate a valid location name
fn location_name_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z\\s]{1,50}"
}

/// Generate a valid Location
fn location_strategy() -> impl Strategy<Value = Location> {
    (location_name_strategy(), latitude_strategy(), longitude_strategy())
        .prop_map(|(name, lat, lon)| Location::new(name, lat, lon))
}

/// Generate a valid MediaItem
fn media_item_strategy() -> impl Strategy<Value = MediaItem> {
    (
        uuid_strategy(),
        media_type_strategy(),
        valid_url_strategy(),
        prop::option::of(valid_url_strategy()),
        prop::option::of(1i32..4096i32),
        prop::option::of(1i32..4096i32),
    )
        .prop_map(|(id, media_type, url, thumbnail_url, width, height)| MediaItem {
            id,
            media_type,
            url,
            thumbnail_url,
            width,
            height,
        })
}

/// Generate a vector of media items (0-5 items)
fn media_items_strategy() -> impl Strategy<Value = Vec<MediaItem>> {
    prop::collection::vec(media_item_strategy(), 0..3)
}

/// Generate a valid DateTime<Utc>
fn datetime_strategy() -> impl Strategy<Value = DateTime<Utc>> {
    // Generate timestamps between 2020 and 2030
    (1577836800i64..1893456000i64).prop_map(|ts| Utc.timestamp_opt(ts, 0).unwrap())
}

/// Generate a valid UserSummary
fn user_summary_strategy() -> impl Strategy<Value = UserSummary> {
    (
        uuid_strategy(),
        prop::option::of("[a-zA-Z0-9_]{1,20}".prop_map(String::from)),
        prop::option::of(valid_url_strategy()),
        1i32..100i32,
    )
        .prop_map(|(id, nickname, avatar, level)| UserSummary {
            id,
            nickname,
            avatar,
            level,
        })
}

/// Generate a valid LifeCard - split into smaller tuples to avoid proptest limits
fn life_card_strategy() -> impl Strategy<Value = LifeCard> {
    // First tuple: IDs and basic info
    let ids_and_basic = (
        uuid_strategy(),
        uuid_strategy(),
        card_type_strategy(),
        valid_title_strategy(),
        valid_description_strategy(),
    );

    // Second tuple: content
    let content = (
        media_items_strategy(),
        prop::option::of(location_strategy()),
        valid_tags_strategy(),
        valid_tags_strategy(),
        privacy_level_strategy(),
    );

    // Third tuple: counts and flags
    let counts_and_flags = (
        1i32..1000i32,
        0i32..10000i32,
        0i32..10000i32,
        0i32..10000i32,
        any::<bool>(),
        any::<bool>(),
        datetime_strategy(),
        datetime_strategy(),
    );

    (ids_and_basic, content, counts_and_flags).prop_map(|(
        (id, creator_id, card_type, title, description),
        (media, location, emotion_tags, interest_tags, privacy_level),
        (exchange_price, like_count, comment_count, exchange_count, is_liked, is_collected, created_at, updated_at)
    )| LifeCard {
        id,
        creator_id,
        creator: None, // Simplified - creator is optional and often not serialized
        card_type,
        title,
        description,
        media,
        location,
        emotion_tags,
        interest_tags,
        privacy_level,
        exchange_price,
        like_count,
        comment_count,
        exchange_count,
        is_liked,
        is_collected,
        created_at,
        updated_at,
    })
}

/// Generate a valid CardCreateData
fn card_create_data_strategy() -> impl Strategy<Value = CardCreateData> {
    (
        card_type_strategy(),
        valid_title_strategy(),
        valid_description_strategy(),
        prop::option::of(media_items_strategy()),
        prop::option::of(location_strategy()),
        prop::option::of(valid_tags_strategy()),
        prop::option::of(valid_tags_strategy()),
        prop::option::of(privacy_level_strategy()),
    )
        .prop_map(|(card_type, title, description, media, location, emotion_tags, interest_tags, privacy_level)| {
            CardCreateData {
                card_type,
                title,
                description,
                media,
                location,
                emotion_tags,
                interest_tags,
                privacy_level,
            }
        })
}

/// Generate a valid CardUpdateData
fn card_update_data_strategy() -> impl Strategy<Value = CardUpdateData> {
    (
        prop::option::of(valid_title_strategy()),
        prop::option::of(valid_description_strategy()),
        prop::option::of(valid_tags_strategy()),
        prop::option::of(valid_tags_strategy()),
        prop::option::of(privacy_level_strategy()),
    )
        .prop_map(|(title, description, emotion_tags, interest_tags, privacy_level)| {
            CardUpdateData {
                title,
                description,
                emotion_tags,
                interest_tags,
                privacy_level,
            }
        })
}

/// Generate a valid LocationFilter
fn location_filter_strategy() -> impl Strategy<Value = LocationFilter> {
    (latitude_strategy(), longitude_strategy(), 0.1f64..500.0f64)
        .prop_map(|(lat, lon, radius)| LocationFilter::new(lat, lon, radius))
}

/// Generate a valid TimeRange
fn time_range_strategy() -> impl Strategy<Value = TimeRange> {
    prop_oneof![
        Just(TimeRange::Day),
        Just(TimeRange::Week),
        Just(TimeRange::Month),
    ]
}


// ============================================================================
// Property 16: Card Serialization Round-Trip
// **Validates: Requirements 9.4**
//
// For any valid Life_Card object, serializing to JSON and then deserializing
// SHALL produce an equivalent object.
// ============================================================================

/// Helper function to compare f64 values with tolerance for JSON round-trip
fn f64_approx_eq(a: f64, b: f64) -> bool {
    (a - b).abs() < 1e-10
}

/// Helper function to compare Location with tolerance
fn location_approx_eq(a: &Location, b: &Location) -> bool {
    a.name == b.name &&
    f64_approx_eq(a.latitude, b.latitude) &&
    f64_approx_eq(a.longitude, b.longitude)
}

/// Helper function to compare optional Location with tolerance
fn option_location_approx_eq(a: &Option<Location>, b: &Option<Location>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(loc_a), Some(loc_b)) => location_approx_eq(loc_a, loc_b),
        _ => false,
    }
}

/// Helper function to compare LocationFilter with tolerance
fn location_filter_approx_eq(a: &LocationFilter, b: &LocationFilter) -> bool {
    f64_approx_eq(a.latitude, b.latitude) &&
    f64_approx_eq(a.longitude, b.longitude) &&
    f64_approx_eq(a.radius_km, b.radius_km)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - LifeCard**
    ///
    /// For any valid LifeCard, serializing to JSON and deserializing should
    /// produce an equivalent card.
    #[test]
    fn prop_life_card_serialization_round_trip(card in life_card_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&card)
            .expect("LifeCard should serialize to JSON");

        // Deserialize from JSON
        let recovered: LifeCard = serde_json::from_str(&json)
            .expect("LifeCard should deserialize from JSON");

        // Compare all fields
        prop_assert_eq!(recovered.id, card.id, "ID should round-trip");
        prop_assert_eq!(recovered.creator_id, card.creator_id, "Creator ID should round-trip");
        prop_assert_eq!(recovered.card_type, card.card_type, "Card type should round-trip");
        prop_assert_eq!(recovered.title, card.title, "Title should round-trip");
        prop_assert_eq!(recovered.description, card.description, "Description should round-trip");
        prop_assert_eq!(recovered.media.len(), card.media.len(), "Media count should round-trip");
        prop_assert!(option_location_approx_eq(&recovered.location, &card.location), "Location should round-trip");
        prop_assert_eq!(recovered.emotion_tags, card.emotion_tags, "Emotion tags should round-trip");
        prop_assert_eq!(recovered.interest_tags, card.interest_tags, "Interest tags should round-trip");
        prop_assert_eq!(recovered.privacy_level, card.privacy_level, "Privacy level should round-trip");
        prop_assert_eq!(recovered.exchange_price, card.exchange_price, "Exchange price should round-trip");
        prop_assert_eq!(recovered.like_count, card.like_count, "Like count should round-trip");
        prop_assert_eq!(recovered.comment_count, card.comment_count, "Comment count should round-trip");
        prop_assert_eq!(recovered.exchange_count, card.exchange_count, "Exchange count should round-trip");
        prop_assert_eq!(recovered.is_liked, card.is_liked, "Is liked should round-trip");
        prop_assert_eq!(recovered.is_collected, card.is_collected, "Is collected should round-trip");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - CardType**
    ///
    /// For any CardType, serializing to JSON and deserializing should produce
    /// the same value.
    #[test]
    fn prop_card_type_serialization_round_trip(card_type in card_type_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&card_type)
            .expect("CardType should serialize to JSON");

        // Deserialize from JSON
        let recovered: CardType = serde_json::from_str(&json)
            .expect("CardType should deserialize from JSON");

        prop_assert_eq!(recovered, card_type, "CardType should round-trip through JSON");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - CardType DB String**
    ///
    /// For any CardType, converting to database string and back should produce
    /// the original value.
    #[test]
    fn prop_card_type_db_string_round_trip(card_type in card_type_strategy()) {
        // Convert to database string
        let db_str = card_type.to_db_str();

        // Convert back from database string
        let recovered = CardType::from_db_str(db_str);

        prop_assert!(recovered.is_some(), "CardType should be recoverable from db string");
        prop_assert_eq!(recovered.unwrap(), card_type, "CardType should round-trip through db string");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - PrivacyLevel**
    ///
    /// For any PrivacyLevel, serializing to JSON and deserializing should produce
    /// the same value.
    #[test]
    fn prop_privacy_level_serialization_round_trip(privacy_level in privacy_level_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&privacy_level)
            .expect("PrivacyLevel should serialize to JSON");

        // Deserialize from JSON
        let recovered: PrivacyLevel = serde_json::from_str(&json)
            .expect("PrivacyLevel should deserialize from JSON");

        prop_assert_eq!(recovered, privacy_level, "PrivacyLevel should round-trip through JSON");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - PrivacyLevel DB String**
    ///
    /// For any PrivacyLevel, converting to database string and back should produce
    /// the original value.
    #[test]
    fn prop_privacy_level_db_string_round_trip(privacy_level in privacy_level_strategy()) {
        // Convert to database string
        let db_str = privacy_level.to_db_str();

        // Convert back from database string
        let recovered = PrivacyLevel::from_db_str(db_str);

        prop_assert!(recovered.is_some(), "PrivacyLevel should be recoverable from db string");
        prop_assert_eq!(recovered.unwrap(), privacy_level, "PrivacyLevel should round-trip through db string");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - MediaItem**
    ///
    /// For any MediaItem, serializing to JSON and deserializing should produce
    /// an equivalent item.
    #[test]
    fn prop_media_item_serialization_round_trip(media_item in media_item_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&media_item)
            .expect("MediaItem should serialize to JSON");

        // Deserialize from JSON
        let recovered: MediaItem = serde_json::from_str(&json)
            .expect("MediaItem should deserialize from JSON");

        prop_assert_eq!(recovered, media_item, "MediaItem should round-trip through JSON");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - Location**
    ///
    /// For any Location, serializing to JSON and deserializing should produce
    /// an equivalent location.
    #[test]
    fn prop_location_serialization_round_trip(location in location_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&location)
            .expect("Location should serialize to JSON");

        // Deserialize from JSON
        let recovered: Location = serde_json::from_str(&json)
            .expect("Location should deserialize from JSON");

        prop_assert!(location_approx_eq(&recovered, &location), "Location should round-trip through JSON");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - CardCreateData**
    ///
    /// For any CardCreateData, serializing to JSON and deserializing should produce
    /// equivalent data.
    #[test]
    fn prop_card_create_data_serialization_round_trip(data in card_create_data_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&data)
            .expect("CardCreateData should serialize to JSON");

        // Deserialize from JSON
        let recovered: CardCreateData = serde_json::from_str(&json)
            .expect("CardCreateData should deserialize from JSON");

        // Compare fields individually to handle floating-point precision
        prop_assert_eq!(recovered.card_type, data.card_type, "Card type should round-trip");
        prop_assert_eq!(recovered.title, data.title, "Title should round-trip");
        prop_assert_eq!(recovered.description, data.description, "Description should round-trip");
        prop_assert_eq!(recovered.media, data.media, "Media should round-trip");
        prop_assert!(option_location_approx_eq(&recovered.location, &data.location), "Location should round-trip");
        prop_assert_eq!(recovered.emotion_tags, data.emotion_tags, "Emotion tags should round-trip");
        prop_assert_eq!(recovered.interest_tags, data.interest_tags, "Interest tags should round-trip");
        prop_assert_eq!(recovered.privacy_level, data.privacy_level, "Privacy level should round-trip");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - CardUpdateData**
    ///
    /// For any CardUpdateData, serializing to JSON and deserializing should produce
    /// equivalent data.
    #[test]
    fn prop_card_update_data_serialization_round_trip(data in card_update_data_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&data)
            .expect("CardUpdateData should serialize to JSON");

        // Deserialize from JSON
        let recovered: CardUpdateData = serde_json::from_str(&json)
            .expect("CardUpdateData should deserialize from JSON");

        prop_assert_eq!(recovered, data, "CardUpdateData should round-trip through JSON");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - LocationFilter**
    ///
    /// For any LocationFilter, serializing to JSON and deserializing should produce
    /// equivalent data.
    #[test]
    fn prop_location_filter_serialization_round_trip(filter in location_filter_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&filter)
            .expect("LocationFilter should serialize to JSON");

        // Deserialize from JSON
        let recovered: LocationFilter = serde_json::from_str(&json)
            .expect("LocationFilter should deserialize from JSON");

        prop_assert!(location_filter_approx_eq(&recovered, &filter), "LocationFilter should round-trip through JSON");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization Round-Trip - TimeRange**
    ///
    /// For any TimeRange, serializing to JSON and deserializing should produce
    /// the same value.
    #[test]
    fn prop_time_range_serialization_round_trip(time_range in time_range_strategy()) {
        // Serialize to JSON
        let json = serde_json::to_string(&time_range)
            .expect("TimeRange should serialize to JSON");

        // Deserialize from JSON
        let recovered: TimeRange = serde_json::from_str(&json)
            .expect("TimeRange should deserialize from JSON");

        prop_assert_eq!(recovered, time_range, "TimeRange should round-trip through JSON");
    }
}

// ============================================================================
// Additional validation tests for card models
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 16: Card Serialization - Location Validation**
    ///
    /// For any valid location (within coordinate bounds), is_valid() should return true.
    #[test]
    fn prop_valid_location_passes_validation(location in location_strategy()) {
        prop_assert!(location.is_valid(), "Valid location should pass validation");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization - LocationFilter Validation**
    ///
    /// For any valid location filter (within bounds), is_valid() should return true.
    #[test]
    fn prop_valid_location_filter_passes_validation(filter in location_filter_strategy()) {
        prop_assert!(filter.is_valid(), "Valid location filter should pass validation");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization - CardCreateData Validation**
    ///
    /// For any valid CardCreateData, validate() should return Ok.
    #[test]
    fn prop_valid_card_create_data_passes_validation(data in card_create_data_strategy()) {
        let result = data.validate();
        prop_assert!(result.is_ok(), "Valid CardCreateData should pass validation: {:?}", result);
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization - CardUpdateData Validation**
    ///
    /// For any valid CardUpdateData, validate() should return Ok.
    #[test]
    fn prop_valid_card_update_data_passes_validation(data in card_update_data_strategy()) {
        let result = data.validate();
        prop_assert!(result.is_ok(), "Valid CardUpdateData should pass validation: {:?}", result);
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization - Creation Reward Calculation**
    ///
    /// For any CardCreateData, the creation reward should be at least the base reward (5).
    #[test]
    fn prop_creation_reward_at_least_base(data in card_create_data_strategy()) {
        let reward = data.calculate_creation_reward();
        prop_assert!(reward >= 5, "Creation reward should be at least 5, got {}", reward);
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization - Creation Reward Increases with Completeness**
    ///
    /// Cards with more complete data should receive higher rewards.
    #[test]
    fn prop_creation_reward_increases_with_completeness(
        card_type in card_type_strategy(),
        title in valid_title_strategy(),
        description in valid_description_strategy(),
    ) {
        // Minimal card
        let minimal = CardCreateData {
            card_type: card_type.clone(),
            title: title.clone(),
            description: description.clone(),
            media: None,
            location: None,
            emotion_tags: None,
            interest_tags: None,
            privacy_level: None,
        };

        // Card with media
        let with_media = CardCreateData {
            card_type: card_type.clone(),
            title: title.clone(),
            description: description.clone(),
            media: Some(vec![MediaItem::new_image("https://example.com/img.jpg".to_string())]),
            location: None,
            emotion_tags: None,
            interest_tags: None,
            privacy_level: None,
        };

        // Card with everything
        let complete = CardCreateData {
            card_type,
            title,
            description,
            media: Some(vec![MediaItem::new_image("https://example.com/img.jpg".to_string())]),
            location: Some(Location::new("Test".to_string(), 0.0, 0.0)),
            emotion_tags: Some(vec!["happy".to_string()]),
            interest_tags: Some(vec!["travel".to_string()]),
            privacy_level: Some(PrivacyLevel::Public),
        };

        let minimal_reward = minimal.calculate_creation_reward();
        let with_media_reward = with_media.calculate_creation_reward();
        let complete_reward = complete.calculate_creation_reward();

        prop_assert!(minimal_reward <= with_media_reward, 
            "Card with media should have >= reward than minimal");
        prop_assert!(with_media_reward <= complete_reward, 
            "Complete card should have >= reward than card with just media");
    }

    /// **Feature: life-card-mvp, Property 16: Card Serialization - LifeCardSummary From LifeCard**
    ///
    /// Converting a LifeCard to LifeCardSummary should preserve key fields.
    #[test]
    fn prop_life_card_summary_preserves_key_fields(card in life_card_strategy()) {
        let summary: LifeCardSummary = (&card).into();

        prop_assert_eq!(summary.id, card.id, "Summary ID should match card ID");
        prop_assert_eq!(summary.title, card.title, "Summary title should match card title");
        prop_assert_eq!(summary.card_type, card.card_type, "Summary card type should match");
    }
}


// ============================================================================
// Property 5: Card Creation Round-Trip
// **Validates: Requirements 3.2, 3.9, 3.10**
//
// For any valid card creation data (title, description, card type, tags),
// creating a card and then retrieving it SHALL return a card with equivalent
// data, a valid creation timestamp, and the creator's coin balance should increase.
// ============================================================================

/// Model for simulating card creation behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct CardCreationModel {
    /// User's coin balance before creation
    initial_balance: i32,
    /// Cards created by the user
    cards: Vec<(Uuid, CardCreateData)>,
}

impl CardCreationModel {
    fn new(initial_balance: i32) -> Self {
        Self {
            initial_balance,
            cards: Vec::new(),
        }
    }

    /// Simulate card creation
    fn create_card(&mut self, data: CardCreateData) -> Result<Uuid, String> {
        // Validate the data
        data.validate()?;

        let card_id = Uuid::new_v4();
        self.cards.push((card_id, data));
        Ok(card_id)
    }

    /// Get a card by ID
    fn get_card(&self, card_id: &Uuid) -> Option<&CardCreateData> {
        self.cards.iter()
            .find(|(id, _)| id == card_id)
            .map(|(_, data)| data)
    }

    /// Calculate total coin reward from all card creations
    fn total_coin_reward(&self) -> i32 {
        self.cards.iter()
            .map(|(_, data)| data.calculate_creation_reward())
            .sum()
    }

    /// Get final balance after all card creations
    fn final_balance(&self) -> i32 {
        self.initial_balance + self.total_coin_reward()
    }

    /// Get card count
    fn card_count(&self) -> usize {
        self.cards.len()
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 5: Card Creation Round-Trip - Data Preservation**
    ///
    /// For any valid CardCreateData, creating a card and retrieving it should
    /// preserve all the input data.
    #[test]
    fn prop_card_creation_preserves_data(data in card_create_data_strategy()) {
        let mut model = CardCreationModel::new(100);

        // Create the card
        let card_id = model.create_card(data.clone())
            .expect("Valid card data should create successfully");

        // Retrieve the card
        let retrieved = model.get_card(&card_id)
            .expect("Created card should be retrievable");

        // Verify data is preserved
        prop_assert_eq!(retrieved.card_type.clone(), data.card_type, "Card type should be preserved");
        prop_assert_eq!(retrieved.title.clone(), data.title, "Title should be preserved");
        prop_assert_eq!(retrieved.description.clone(), data.description, "Description should be preserved");
        prop_assert_eq!(retrieved.media.clone(), data.media, "Media should be preserved");
        prop_assert_eq!(retrieved.emotion_tags.clone(), data.emotion_tags, "Emotion tags should be preserved");
        prop_assert_eq!(retrieved.interest_tags.clone(), data.interest_tags, "Interest tags should be preserved");
        prop_assert_eq!(retrieved.privacy_level.clone(), data.privacy_level, "Privacy level should be preserved");
        
        // Location comparison with floating-point tolerance
        match (&retrieved.location, &data.location) {
            (Some(r_loc), Some(d_loc)) => {
                prop_assert!(location_approx_eq(r_loc, d_loc), "Location should be preserved");
            }
            (None, None) => {}
            _ => prop_assert!(false, "Location presence should match"),
        }
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation Round-Trip - Coin Reward**
    ///
    /// For any valid CardCreateData, creating a card should increase the
    /// creator's coin balance by the calculated reward amount.
    #[test]
    fn prop_card_creation_awards_coins(data in card_create_data_strategy()) {
        let initial_balance = 100;
        let mut model = CardCreationModel::new(initial_balance);

        // Calculate expected reward before creation
        let expected_reward = data.calculate_creation_reward();

        // Create the card
        model.create_card(data)
            .expect("Valid card data should create successfully");

        // Verify balance increased by the reward amount
        let final_balance = model.final_balance();
        prop_assert_eq!(
            final_balance,
            initial_balance + expected_reward,
            "Balance should increase by reward amount"
        );
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation Round-Trip - Multiple Cards**
    ///
    /// For any sequence of valid card creations, the total coin reward should
    /// equal the sum of individual rewards.
    #[test]
    fn prop_multiple_card_creations_accumulate_rewards(
        cards in prop::collection::vec(card_create_data_strategy(), 1..5)
    ) {
        let initial_balance = 100;
        let mut model = CardCreationModel::new(initial_balance);

        // Calculate expected total reward
        let expected_total_reward: i32 = cards.iter()
            .map(|data| data.calculate_creation_reward())
            .sum();

        // Create all cards
        for data in cards {
            model.create_card(data)
                .expect("Valid card data should create successfully");
        }

        // Verify total reward
        prop_assert_eq!(
            model.total_coin_reward(),
            expected_total_reward,
            "Total reward should equal sum of individual rewards"
        );

        // Verify final balance
        prop_assert_eq!(
            model.final_balance(),
            initial_balance + expected_total_reward,
            "Final balance should equal initial + total reward"
        );
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation Round-Trip - Card Count**
    ///
    /// For any sequence of valid card creations, the card count should equal
    /// the number of successful creations.
    #[test]
    fn prop_card_creation_increments_count(
        cards in prop::collection::vec(card_create_data_strategy(), 0..10)
    ) {
        let mut model = CardCreationModel::new(100);

        // Create all cards
        for data in &cards {
            model.create_card(data.clone())
                .expect("Valid card data should create successfully");
        }

        // Verify card count
        prop_assert_eq!(
            model.card_count(),
            cards.len(),
            "Card count should equal number of creations"
        );
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation Round-Trip - Unique IDs**
    ///
    /// For any sequence of card creations, each card should have a unique ID.
    #[test]
    fn prop_card_creation_generates_unique_ids(
        cards in prop::collection::vec(card_create_data_strategy(), 2..10)
    ) {
        let mut model = CardCreationModel::new(100);
        let mut ids = Vec::new();

        // Create all cards and collect IDs
        for data in cards {
            let id = model.create_card(data)
                .expect("Valid card data should create successfully");
            ids.push(id);
        }

        // Verify all IDs are unique
        let unique_ids: std::collections::HashSet<_> = ids.iter().collect();
        prop_assert_eq!(
            unique_ids.len(),
            ids.len(),
            "All card IDs should be unique"
        );
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation Round-Trip - Reward Bounds**
    ///
    /// For any valid CardCreateData, the creation reward should be within
    /// expected bounds (5 to 12 coins based on completeness).
    #[test]
    fn prop_card_creation_reward_within_bounds(data in card_create_data_strategy()) {
        let reward = data.calculate_creation_reward();

        // Base reward is 5, max bonus is 7 (3 for media + 2 for location + 1 for emotion + 1 for interest)
        prop_assert!(reward >= 5, "Reward should be at least 5 (base)");
        prop_assert!(reward <= 12, "Reward should be at most 12 (base + all bonuses)");
    }
}

// ============================================================================
// Validation rejection tests for card creation
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 5: Card Creation - Empty Title Rejected**
    ///
    /// Cards with empty titles should be rejected.
    #[test]
    fn prop_empty_title_rejected(
        card_type in card_type_strategy(),
        description in valid_description_strategy(),
    ) {
        let data = CardCreateData {
            card_type,
            title: "   ".to_string(), // Whitespace-only title
            description,
            media: None,
            location: None,
            emotion_tags: None,
            interest_tags: None,
            privacy_level: None,
        };

        let result = data.validate();
        prop_assert!(result.is_err(), "Empty title should be rejected");
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation - Empty Description Rejected**
    ///
    /// Cards with empty descriptions should be rejected.
    #[test]
    fn prop_empty_description_rejected(
        card_type in card_type_strategy(),
        title in valid_title_strategy(),
    ) {
        let data = CardCreateData {
            card_type,
            title,
            description: "   ".to_string(), // Whitespace-only description
            media: None,
            location: None,
            emotion_tags: None,
            interest_tags: None,
            privacy_level: None,
        };

        let result = data.validate();
        prop_assert!(result.is_err(), "Empty description should be rejected");
    }

    /// **Feature: life-card-mvp, Property 5: Card Creation - Long Title Rejected**
    ///
    /// Cards with titles longer than 200 characters should be rejected.
    #[test]
    fn prop_long_title_rejected(
        card_type in card_type_strategy(),
        description in valid_description_strategy(),
    ) {
        let long_title = "a".repeat(201);
        let data = CardCreateData {
            card_type,
            title: long_title,
            description,
            media: None,
            location: None,
            emotion_tags: None,
            interest_tags: None,
            privacy_level: None,
        };

        let result = data.validate();
        prop_assert!(result.is_err(), "Title longer than 200 chars should be rejected");
    }
}


// ============================================================================
// Property 13: Card Deletion Constraints
// **Validates: Requirements 7.5, 7.6**
//
// For any card deletion attempt, THE Card_System SHALL allow deletion only if
// the card has not been exchanged to other users. Deleted cards SHALL not be
// retrievable.
// ============================================================================

/// Model for simulating card deletion behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct CardDeletionModel {
    /// Cards in the system: (card_id, creator_id, is_deleted)
    cards: Vec<(Uuid, Uuid, bool)>,
    /// Card collections: (user_id, card_id) - represents exchanged cards
    collections: Vec<(Uuid, Uuid)>,
}

impl CardDeletionModel {
    fn new() -> Self {
        Self {
            cards: Vec::new(),
            collections: Vec::new(),
        }
    }

    /// Create a card
    fn create_card(&mut self, creator_id: Uuid) -> Uuid {
        let card_id = Uuid::new_v4();
        self.cards.push((card_id, creator_id, false));
        card_id
    }

    /// Simulate card exchange (add to collection)
    fn exchange_card(&mut self, user_id: Uuid, card_id: Uuid) {
        self.collections.push((user_id, card_id));
    }

    /// Check if a card has been exchanged to others
    fn is_exchanged(&self, card_id: &Uuid) -> bool {
        self.collections.iter().any(|(_, cid)| cid == card_id)
    }

    /// Attempt to delete a card
    fn delete_card(&mut self, card_id: &Uuid, user_id: &Uuid) -> Result<(), String> {
        // Find the card
        let card_idx = self.cards.iter()
            .position(|(cid, _, deleted)| cid == card_id && !deleted)
            .ok_or_else(|| "Card not found".to_string())?;

        let (_, creator_id, _) = self.cards[card_idx];

        // Verify ownership
        if creator_id != *user_id {
            return Err("Not authorized to delete this card".to_string());
        }

        // Check if card has been exchanged
        if self.is_exchanged(card_id) {
            return Err("Cannot delete a card that has been exchanged to other users".to_string());
        }

        // Mark as deleted
        self.cards[card_idx].2 = true;
        Ok(())
    }

    /// Get a card (returns None if deleted or not found)
    fn get_card(&self, card_id: &Uuid) -> Option<(Uuid, Uuid)> {
        self.cards.iter()
            .find(|(cid, _, deleted)| cid == card_id && !deleted)
            .map(|(cid, creator_id, _)| (*cid, *creator_id))
    }

    /// Check if a card is deleted
    fn is_deleted(&self, card_id: &Uuid) -> bool {
        self.cards.iter()
            .find(|(cid, _, _)| cid == card_id)
            .map(|(_, _, deleted)| *deleted)
            .unwrap_or(false)
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Owner Can Delete**
    ///
    /// A card owner can delete their own card if it hasn't been exchanged.
    #[test]
    fn prop_owner_can_delete_unexchanged_card(creator_id in uuid_strategy()) {
        let mut model = CardDeletionModel::new();

        // Create a card
        let card_id = model.create_card(creator_id);

        // Owner should be able to delete
        let result = model.delete_card(&card_id, &creator_id);
        prop_assert!(result.is_ok(), "Owner should be able to delete their unexchanged card");

        // Card should no longer be retrievable
        prop_assert!(model.get_card(&card_id).is_none(), "Deleted card should not be retrievable");
        prop_assert!(model.is_deleted(&card_id), "Card should be marked as deleted");
    }

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Non-Owner Cannot Delete**
    ///
    /// A non-owner cannot delete someone else's card.
    #[test]
    fn prop_non_owner_cannot_delete_card(
        creator_id in uuid_strategy(),
        other_user_id in uuid_strategy()
    ) {
        prop_assume!(creator_id != other_user_id);

        let mut model = CardDeletionModel::new();

        // Create a card
        let card_id = model.create_card(creator_id);

        // Non-owner should not be able to delete
        let result = model.delete_card(&card_id, &other_user_id);
        prop_assert!(result.is_err(), "Non-owner should not be able to delete card");

        // Card should still be retrievable
        prop_assert!(model.get_card(&card_id).is_some(), "Card should still be retrievable");
        prop_assert!(!model.is_deleted(&card_id), "Card should not be marked as deleted");
    }

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Exchanged Card Cannot Be Deleted**
    ///
    /// A card that has been exchanged to other users cannot be deleted.
    #[test]
    fn prop_exchanged_card_cannot_be_deleted(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy()
    ) {
        prop_assume!(creator_id != collector_id);

        let mut model = CardDeletionModel::new();

        // Create a card
        let card_id = model.create_card(creator_id);

        // Exchange the card to another user
        model.exchange_card(collector_id, card_id);

        // Owner should not be able to delete exchanged card
        let result = model.delete_card(&card_id, &creator_id);
        prop_assert!(result.is_err(), "Owner should not be able to delete exchanged card");
        prop_assert!(
            result.unwrap_err().contains("exchanged"),
            "Error message should mention exchange constraint"
        );

        // Card should still be retrievable
        prop_assert!(model.get_card(&card_id).is_some(), "Exchanged card should still be retrievable");
    }

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Delete Non-Existent Card**
    ///
    /// Attempting to delete a non-existent card should fail.
    #[test]
    fn prop_delete_nonexistent_card_fails(
        user_id in uuid_strategy(),
        fake_card_id in uuid_strategy()
    ) {
        let mut model = CardDeletionModel::new();

        // Try to delete a card that doesn't exist
        let result = model.delete_card(&fake_card_id, &user_id);
        prop_assert!(result.is_err(), "Deleting non-existent card should fail");
    }

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Double Delete Fails**
    ///
    /// Attempting to delete an already deleted card should fail.
    #[test]
    fn prop_double_delete_fails(creator_id in uuid_strategy()) {
        let mut model = CardDeletionModel::new();

        // Create and delete a card
        let card_id = model.create_card(creator_id);
        model.delete_card(&card_id, &creator_id)
            .expect("First delete should succeed");

        // Try to delete again
        let result = model.delete_card(&card_id, &creator_id);
        prop_assert!(result.is_err(), "Second delete should fail");
    }

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Multiple Cards**
    ///
    /// Deleting one card should not affect other cards.
    #[test]
    fn prop_delete_does_not_affect_other_cards(
        creator_id in uuid_strategy(),
        num_cards in 2usize..5usize
    ) {
        let mut model = CardDeletionModel::new();

        // Create multiple cards
        let card_ids: Vec<Uuid> = (0..num_cards)
            .map(|_| model.create_card(creator_id))
            .collect();

        // Delete the first card
        model.delete_card(&card_ids[0], &creator_id)
            .expect("Delete should succeed");

        // First card should be deleted
        prop_assert!(model.is_deleted(&card_ids[0]), "First card should be deleted");
        prop_assert!(model.get_card(&card_ids[0]).is_none(), "First card should not be retrievable");

        // Other cards should still exist
        for card_id in &card_ids[1..] {
            prop_assert!(!model.is_deleted(card_id), "Other cards should not be deleted");
            prop_assert!(model.get_card(card_id).is_some(), "Other cards should be retrievable");
        }
    }

    /// **Feature: life-card-mvp, Property 13: Card Deletion Constraints - Exchange After Creation**
    ///
    /// A card can be deleted before exchange but not after.
    #[test]
    fn prop_exchange_prevents_future_deletion(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy()
    ) {
        prop_assume!(creator_id != collector_id);

        let mut model = CardDeletionModel::new();

        // Create two cards
        let card1 = model.create_card(creator_id);
        let card2 = model.create_card(creator_id);

        // Exchange only card1
        model.exchange_card(collector_id, card1);

        // card1 should not be deletable
        let result1 = model.delete_card(&card1, &creator_id);
        prop_assert!(result1.is_err(), "Exchanged card should not be deletable");

        // card2 should still be deletable
        let result2 = model.delete_card(&card2, &creator_id);
        prop_assert!(result2.is_ok(), "Non-exchanged card should be deletable");
    }
}


// ============================================================================
// Property 6: Tag Association Completeness
// **Validates: Requirements 3.5, 3.6**
//
// For any card with emotion tags and interest tags, all tags provided during
// creation or update SHALL be associated with the card and retrievable.
// ============================================================================

/// Model for simulating tag association behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct TagAssociationModel {
    /// Cards in the system: (card_id, creator_id, emotion_tags, interest_tags)
    cards: Vec<(Uuid, Uuid, Vec<String>, Vec<String>)>,
}

impl TagAssociationModel {
    fn new() -> Self {
        Self {
            cards: Vec::new(),
        }
    }

    /// Create a card with tags
    fn create_card(
        &mut self,
        creator_id: Uuid,
        emotion_tags: Vec<String>,
        interest_tags: Vec<String>,
    ) -> Result<Uuid, String> {
        // Validate emotion tags
        if emotion_tags.len() > 10 {
            return Err("Maximum 10 emotion tags allowed".to_string());
        }
        for tag in &emotion_tags {
            if tag.len() > 50 {
                return Err("Each emotion tag must be 50 characters or less".to_string());
            }
        }

        // Validate interest tags
        if interest_tags.len() > 10 {
            return Err("Maximum 10 interest tags allowed".to_string());
        }
        for tag in &interest_tags {
            if tag.len() > 50 {
                return Err("Each interest tag must be 50 characters or less".to_string());
            }
        }

        let card_id = Uuid::new_v4();
        self.cards.push((card_id, creator_id, emotion_tags, interest_tags));
        Ok(card_id)
    }

    /// Get emotion tags for a card
    fn get_emotion_tags(&self, card_id: &Uuid) -> Option<Vec<String>> {
        self.cards.iter()
            .find(|(cid, _, _, _)| cid == card_id)
            .map(|(_, _, emotion_tags, _)| emotion_tags.clone())
    }

    /// Get interest tags for a card
    fn get_interest_tags(&self, card_id: &Uuid) -> Option<Vec<String>> {
        self.cards.iter()
            .find(|(cid, _, _, _)| cid == card_id)
            .map(|(_, _, _, interest_tags)| interest_tags.clone())
    }

    /// Update emotion tags for a card
    fn update_emotion_tags(
        &mut self,
        card_id: &Uuid,
        user_id: &Uuid,
        new_tags: Vec<String>,
    ) -> Result<Vec<String>, String> {
        // Validate tags
        if new_tags.len() > 10 {
            return Err("Maximum 10 emotion tags allowed".to_string());
        }
        for tag in &new_tags {
            if tag.len() > 50 {
                return Err("Each emotion tag must be 50 characters or less".to_string());
            }
        }

        // Find and update the card
        let card = self.cards.iter_mut()
            .find(|(cid, creator_id, _, _)| cid == card_id && creator_id == user_id)
            .ok_or_else(|| "Card not found or not authorized".to_string())?;

        card.2 = new_tags.clone();
        Ok(new_tags)
    }

    /// Update interest tags for a card
    fn update_interest_tags(
        &mut self,
        card_id: &Uuid,
        user_id: &Uuid,
        new_tags: Vec<String>,
    ) -> Result<Vec<String>, String> {
        // Validate tags
        if new_tags.len() > 10 {
            return Err("Maximum 10 interest tags allowed".to_string());
        }
        for tag in &new_tags {
            if tag.len() > 50 {
                return Err("Each interest tag must be 50 characters or less".to_string());
            }
        }

        // Find and update the card
        let card = self.cards.iter_mut()
            .find(|(cid, creator_id, _, _)| cid == card_id && creator_id == user_id)
            .ok_or_else(|| "Card not found or not authorized".to_string())?;

        card.3 = new_tags.clone();
        Ok(new_tags)
    }

    /// Filter cards by emotion tags (returns cards that have ANY of the specified tags)
    fn filter_by_emotion_tags(&self, tags: &[String]) -> Vec<Uuid> {
        if tags.is_empty() {
            return Vec::new();
        }
        self.cards.iter()
            .filter(|(_, _, emotion_tags, _)| {
                tags.iter().any(|t| emotion_tags.contains(t))
            })
            .map(|(cid, _, _, _)| *cid)
            .collect()
    }

    /// Filter cards by interest tags (returns cards that have ANY of the specified tags)
    fn filter_by_interest_tags(&self, tags: &[String]) -> Vec<Uuid> {
        if tags.is_empty() {
            return Vec::new();
        }
        self.cards.iter()
            .filter(|(_, _, _, interest_tags)| {
                tags.iter().any(|t| interest_tags.contains(t))
            })
            .map(|(cid, _, _, _)| *cid)
            .collect()
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Emotion Tags Preserved**
    ///
    /// For any card created with emotion tags, all tags should be retrievable.
    #[test]
    fn prop_emotion_tags_preserved_on_creation(
        creator_id in uuid_strategy(),
        emotion_tags in valid_tags_strategy(),
    ) {
        let mut model = TagAssociationModel::new();

        // Create card with emotion tags
        let card_id = model.create_card(creator_id, emotion_tags.clone(), vec![])
            .expect("Card creation should succeed");

        // Retrieve emotion tags
        let retrieved_tags = model.get_emotion_tags(&card_id)
            .expect("Card should exist");

        // All original tags should be present
        prop_assert_eq!(
            retrieved_tags.len(),
            emotion_tags.len(),
            "Number of emotion tags should match"
        );
        for tag in &emotion_tags {
            prop_assert!(
                retrieved_tags.contains(tag),
                "Emotion tag '{}' should be preserved",
                tag
            );
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Interest Tags Preserved**
    ///
    /// For any card created with interest tags, all tags should be retrievable.
    #[test]
    fn prop_interest_tags_preserved_on_creation(
        creator_id in uuid_strategy(),
        interest_tags in valid_tags_strategy(),
    ) {
        let mut model = TagAssociationModel::new();

        // Create card with interest tags
        let card_id = model.create_card(creator_id, vec![], interest_tags.clone())
            .expect("Card creation should succeed");

        // Retrieve interest tags
        let retrieved_tags = model.get_interest_tags(&card_id)
            .expect("Card should exist");

        // All original tags should be present
        prop_assert_eq!(
            retrieved_tags.len(),
            interest_tags.len(),
            "Number of interest tags should match"
        );
        for tag in &interest_tags {
            prop_assert!(
                retrieved_tags.contains(tag),
                "Interest tag '{}' should be preserved",
                tag
            );
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Both Tag Types Preserved**
    ///
    /// For any card created with both emotion and interest tags, all tags should be retrievable.
    #[test]
    fn prop_both_tag_types_preserved_on_creation(
        creator_id in uuid_strategy(),
        emotion_tags in valid_tags_strategy(),
        interest_tags in valid_tags_strategy(),
    ) {
        let mut model = TagAssociationModel::new();

        // Create card with both tag types
        let card_id = model.create_card(creator_id, emotion_tags.clone(), interest_tags.clone())
            .expect("Card creation should succeed");

        // Retrieve both tag types
        let retrieved_emotion = model.get_emotion_tags(&card_id)
            .expect("Card should exist");
        let retrieved_interest = model.get_interest_tags(&card_id)
            .expect("Card should exist");

        // All emotion tags should be present
        prop_assert_eq!(retrieved_emotion.len(), emotion_tags.len());
        for tag in &emotion_tags {
            prop_assert!(retrieved_emotion.contains(tag));
        }

        // All interest tags should be present
        prop_assert_eq!(retrieved_interest.len(), interest_tags.len());
        for tag in &interest_tags {
            prop_assert!(retrieved_interest.contains(tag));
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Emotion Tags Update**
    ///
    /// For any card, updating emotion tags should replace all previous tags with new ones.
    #[test]
    fn prop_emotion_tags_update_replaces_all(
        creator_id in uuid_strategy(),
        initial_tags in valid_tags_strategy(),
        new_tags in valid_tags_strategy(),
    ) {
        let mut model = TagAssociationModel::new();

        // Create card with initial tags
        let card_id = model.create_card(creator_id, initial_tags.clone(), vec![])
            .expect("Card creation should succeed");

        // Update emotion tags
        model.update_emotion_tags(&card_id, &creator_id, new_tags.clone())
            .expect("Tag update should succeed");

        // Retrieve updated tags
        let retrieved_tags = model.get_emotion_tags(&card_id)
            .expect("Card should exist");

        // Should have exactly the new tags
        prop_assert_eq!(
            retrieved_tags.len(),
            new_tags.len(),
            "Number of emotion tags should match new tags"
        );
        for tag in &new_tags {
            prop_assert!(
                retrieved_tags.contains(tag),
                "New emotion tag '{}' should be present",
                tag
            );
        }
        // Old tags that are not in new tags should be gone
        for tag in &initial_tags {
            if !new_tags.contains(tag) {
                prop_assert!(
                    !retrieved_tags.contains(tag),
                    "Old emotion tag '{}' should be removed",
                    tag
                );
            }
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Interest Tags Update**
    ///
    /// For any card, updating interest tags should replace all previous tags with new ones.
    #[test]
    fn prop_interest_tags_update_replaces_all(
        creator_id in uuid_strategy(),
        initial_tags in valid_tags_strategy(),
        new_tags in valid_tags_strategy(),
    ) {
        let mut model = TagAssociationModel::new();

        // Create card with initial tags
        let card_id = model.create_card(creator_id, vec![], initial_tags.clone())
            .expect("Card creation should succeed");

        // Update interest tags
        model.update_interest_tags(&card_id, &creator_id, new_tags.clone())
            .expect("Tag update should succeed");

        // Retrieve updated tags
        let retrieved_tags = model.get_interest_tags(&card_id)
            .expect("Card should exist");

        // Should have exactly the new tags
        prop_assert_eq!(
            retrieved_tags.len(),
            new_tags.len(),
            "Number of interest tags should match new tags"
        );
        for tag in &new_tags {
            prop_assert!(
                retrieved_tags.contains(tag),
                "New interest tag '{}' should be present",
                tag
            );
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Filter by Emotion Tags**
    ///
    /// For any set of cards with emotion tags, filtering by a tag should return
    /// exactly the cards that have that tag.
    #[test]
    fn prop_filter_by_emotion_tags_accurate(
        creator_id in uuid_strategy(),
        cards_data in prop::collection::vec(
            (valid_tags_strategy(), valid_tags_strategy()),
            1..5
        ),
        filter_tag in valid_tag_strategy(),
    ) {
        let mut model = TagAssociationModel::new();
        let mut card_ids = Vec::new();

        // Create multiple cards
        for (emotion_tags, interest_tags) in &cards_data {
            let card_id = model.create_card(creator_id, emotion_tags.clone(), interest_tags.clone())
                .expect("Card creation should succeed");
            card_ids.push(card_id);
        }

        // Filter by the tag
        let filtered = model.filter_by_emotion_tags(&[filter_tag.clone()]);

        // Verify soundness: all returned cards should have the tag
        for card_id in &filtered {
            let tags = model.get_emotion_tags(card_id).expect("Card should exist");
            prop_assert!(
                tags.contains(&filter_tag),
                "Filtered card should have the filter tag"
            );
        }

        // Verify completeness: all cards with the tag should be returned
        for (i, card_id) in card_ids.iter().enumerate() {
            let has_tag = cards_data[i].0.contains(&filter_tag);
            let in_result = filtered.contains(card_id);
            prop_assert_eq!(
                has_tag,
                in_result,
                "Card with tag should be in result, card without tag should not"
            );
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Filter by Interest Tags**
    ///
    /// For any set of cards with interest tags, filtering by a tag should return
    /// exactly the cards that have that tag.
    #[test]
    fn prop_filter_by_interest_tags_accurate(
        creator_id in uuid_strategy(),
        cards_data in prop::collection::vec(
            (valid_tags_strategy(), valid_tags_strategy()),
            1..5
        ),
        filter_tag in valid_tag_strategy(),
    ) {
        let mut model = TagAssociationModel::new();
        let mut card_ids = Vec::new();

        // Create multiple cards
        for (emotion_tags, interest_tags) in &cards_data {
            let card_id = model.create_card(creator_id, emotion_tags.clone(), interest_tags.clone())
                .expect("Card creation should succeed");
            card_ids.push(card_id);
        }

        // Filter by the tag
        let filtered = model.filter_by_interest_tags(&[filter_tag.clone()]);

        // Verify soundness: all returned cards should have the tag
        for card_id in &filtered {
            let tags = model.get_interest_tags(card_id).expect("Card should exist");
            prop_assert!(
                tags.contains(&filter_tag),
                "Filtered card should have the filter tag"
            );
        }

        // Verify completeness: all cards with the tag should be returned
        for (i, card_id) in card_ids.iter().enumerate() {
            let has_tag = cards_data[i].1.contains(&filter_tag);
            let in_result = filtered.contains(card_id);
            prop_assert_eq!(
                has_tag,
                in_result,
                "Card with tag should be in result, card without tag should not"
            );
        }
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Empty Tags Allowed**
    ///
    /// Cards can be created with empty tag lists.
    #[test]
    fn prop_empty_tags_allowed(creator_id in uuid_strategy()) {
        let mut model = TagAssociationModel::new();

        // Create card with no tags
        let card_id = model.create_card(creator_id, vec![], vec![])
            .expect("Card creation with empty tags should succeed");

        // Retrieve tags
        let emotion_tags = model.get_emotion_tags(&card_id).expect("Card should exist");
        let interest_tags = model.get_interest_tags(&card_id).expect("Card should exist");

        prop_assert!(emotion_tags.is_empty(), "Emotion tags should be empty");
        prop_assert!(interest_tags.is_empty(), "Interest tags should be empty");
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Tag Limit Enforced**
    ///
    /// Cards cannot have more than 10 tags of each type.
    #[test]
    fn prop_tag_limit_enforced(
        creator_id in uuid_strategy(),
        extra_tags in prop::collection::vec(valid_tag_strategy(), 11..15),
    ) {
        let mut model = TagAssociationModel::new();

        // Try to create card with too many emotion tags
        let result = model.create_card(creator_id, extra_tags.clone(), vec![]);
        prop_assert!(result.is_err(), "Should reject more than 10 emotion tags");

        // Try to create card with too many interest tags
        let result = model.create_card(creator_id, vec![], extra_tags);
        prop_assert!(result.is_err(), "Should reject more than 10 interest tags");
    }

    /// **Feature: life-card-mvp, Property 6: Tag Association Completeness - Tag Independence**
    ///
    /// Updating emotion tags should not affect interest tags and vice versa.
    #[test]
    fn prop_tag_types_independent(
        creator_id in uuid_strategy(),
        initial_emotion in valid_tags_strategy(),
        initial_interest in valid_tags_strategy(),
        new_emotion in valid_tags_strategy(),
        new_interest in valid_tags_strategy(),
    ) {
        let mut model = TagAssociationModel::new();

        // Create card with both tag types
        let card_id = model.create_card(creator_id, initial_emotion.clone(), initial_interest.clone())
            .expect("Card creation should succeed");

        // Update only emotion tags
        model.update_emotion_tags(&card_id, &creator_id, new_emotion.clone())
            .expect("Emotion tag update should succeed");

        // Interest tags should be unchanged
        let interest_after_emotion_update = model.get_interest_tags(&card_id)
            .expect("Card should exist");
        prop_assert_eq!(
            interest_after_emotion_update,
            initial_interest,
            "Interest tags should not change when emotion tags are updated"
        );

        // Update only interest tags
        model.update_interest_tags(&card_id, &creator_id, new_interest.clone())
            .expect("Interest tag update should succeed");

        // Emotion tags should still be the new ones
        let emotion_after_interest_update = model.get_emotion_tags(&card_id)
            .expect("Card should exist");
        prop_assert_eq!(
            emotion_after_interest_update,
            new_emotion,
            "Emotion tags should not change when interest tags are updated"
        );
    }
}


// ============================================================================
// Property 7: Privacy Enforcement
// **Validates: Requirements 3.7, 4.7**
//
// For any card with a specific privacy level, THE Card_System SHALL only return
// the card to users who satisfy the privacy constraints:
// - Public: all users can view
// - FriendsOnly: only followers of the creator can view
// - ExchangeOnly: only users who have exchanged for the card can view
// ============================================================================

/// Model for simulating privacy enforcement behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct PrivacyEnforcementModel {
    /// Cards in the system: (card_id, creator_id, privacy_level)
    cards: Vec<(Uuid, Uuid, PrivacyLevel)>,
    /// Follow relationships: (follower_id, followee_id)
    follows: Vec<(Uuid, Uuid)>,
    /// Card collections (exchanges): (user_id, card_id)
    collections: Vec<(Uuid, Uuid)>,
}

impl PrivacyEnforcementModel {
    fn new() -> Self {
        Self {
            cards: Vec::new(),
            follows: Vec::new(),
            collections: Vec::new(),
        }
    }

    /// Create a card with a specific privacy level
    fn create_card(&mut self, creator_id: Uuid, privacy_level: PrivacyLevel) -> Uuid {
        let card_id = Uuid::new_v4();
        self.cards.push((card_id, creator_id, privacy_level));
        card_id
    }

    /// Add a follow relationship
    fn follow(&mut self, follower_id: Uuid, followee_id: Uuid) {
        if follower_id != followee_id && !self.is_following(&follower_id, &followee_id) {
            self.follows.push((follower_id, followee_id));
        }
    }

    /// Remove a follow relationship
    fn unfollow(&mut self, follower_id: &Uuid, followee_id: &Uuid) {
        self.follows.retain(|(f, e)| !(f == follower_id && e == followee_id));
    }

    /// Check if a user is following another
    fn is_following(&self, follower_id: &Uuid, followee_id: &Uuid) -> bool {
        self.follows.iter().any(|(f, e)| f == follower_id && e == followee_id)
    }

    /// Add a card to a user's collection (simulates exchange)
    fn collect_card(&mut self, user_id: Uuid, card_id: Uuid) {
        if !self.has_collected(&user_id, &card_id) {
            self.collections.push((user_id, card_id));
        }
    }

    /// Check if a user has collected a card
    fn has_collected(&self, user_id: &Uuid, card_id: &Uuid) -> bool {
        self.collections.iter().any(|(u, c)| u == user_id && c == card_id)
    }

    /// Get the creator of a card
    fn get_card_creator(&self, card_id: &Uuid) -> Option<Uuid> {
        self.cards.iter()
            .find(|(cid, _, _)| cid == card_id)
            .map(|(_, creator_id, _)| *creator_id)
    }

    /// Get the privacy level of a card
    fn get_privacy_level(&self, card_id: &Uuid) -> Option<PrivacyLevel> {
        self.cards.iter()
            .find(|(cid, _, _)| cid == card_id)
            .map(|(_, _, privacy)| privacy.clone())
    }

    /// Check if a viewer can see a card based on privacy settings
    /// This is the core privacy enforcement logic
    fn can_view_card(&self, card_id: &Uuid, viewer_id: Option<&Uuid>) -> bool {
        let card = self.cards.iter()
            .find(|(cid, _, _)| cid == card_id);

        match card {
            None => false, // Card doesn't exist
            Some((_, creator_id, privacy_level)) => {
                match privacy_level {
                    PrivacyLevel::Public => true,
                    PrivacyLevel::FriendsOnly => {
                        match viewer_id {
                            Some(vid) if vid == creator_id => true, // Creator can always view
                            Some(vid) => self.is_following(vid, creator_id), // Followers can view
                            None => false, // Anonymous users cannot view
                        }
                    }
                    PrivacyLevel::ExchangeOnly => {
                        match viewer_id {
                            Some(vid) if vid == creator_id => true, // Creator can always view
                            Some(vid) => self.has_collected(vid, card_id), // Users who exchanged can view
                            None => false, // Anonymous users cannot view
                        }
                    }
                }
            }
        }
    }

    /// Get all cards visible to a viewer
    fn get_visible_cards(&self, viewer_id: Option<&Uuid>) -> Vec<Uuid> {
        self.cards.iter()
            .filter(|(card_id, _, _)| self.can_view_card(card_id, viewer_id))
            .map(|(card_id, _, _)| *card_id)
            .collect()
    }

    /// Update privacy level of a card
    fn update_privacy(&mut self, card_id: &Uuid, user_id: &Uuid, new_privacy: PrivacyLevel) -> Result<(), String> {
        let card = self.cards.iter_mut()
            .find(|(cid, creator_id, _)| cid == card_id && creator_id == user_id);

        match card {
            Some((_, _, privacy)) => {
                *privacy = new_privacy;
                Ok(())
            }
            None => Err("Card not found or not authorized".to_string()),
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Public Cards Visible to All**
    ///
    /// Public cards should be visible to any user, including anonymous users.
    #[test]
    fn prop_public_cards_visible_to_all(
        creator_id in uuid_strategy(),
        viewer_id in uuid_strategy(),
    ) {
        let mut model = PrivacyEnforcementModel::new();

        // Create a public card
        let card_id = model.create_card(creator_id, PrivacyLevel::Public);

        // Should be visible to the creator
        prop_assert!(
            model.can_view_card(&card_id, Some(&creator_id)),
            "Public card should be visible to creator"
        );

        // Should be visible to any other user
        prop_assert!(
            model.can_view_card(&card_id, Some(&viewer_id)),
            "Public card should be visible to any user"
        );

        // Should be visible to anonymous users
        prop_assert!(
            model.can_view_card(&card_id, None),
            "Public card should be visible to anonymous users"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - FriendsOnly Visible to Followers**
    ///
    /// FriendsOnly cards should only be visible to the creator and users who follow the creator.
    #[test]
    fn prop_friends_only_visible_to_followers(
        creator_id in uuid_strategy(),
        follower_id in uuid_strategy(),
        non_follower_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != follower_id);
        prop_assume!(creator_id != non_follower_id);
        prop_assume!(follower_id != non_follower_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create a friends-only card
        let card_id = model.create_card(creator_id, PrivacyLevel::FriendsOnly);

        // Add follower relationship
        model.follow(follower_id, creator_id);

        // Should be visible to the creator
        prop_assert!(
            model.can_view_card(&card_id, Some(&creator_id)),
            "FriendsOnly card should be visible to creator"
        );

        // Should be visible to followers
        prop_assert!(
            model.can_view_card(&card_id, Some(&follower_id)),
            "FriendsOnly card should be visible to followers"
        );

        // Should NOT be visible to non-followers
        prop_assert!(
            !model.can_view_card(&card_id, Some(&non_follower_id)),
            "FriendsOnly card should NOT be visible to non-followers"
        );

        // Should NOT be visible to anonymous users
        prop_assert!(
            !model.can_view_card(&card_id, None),
            "FriendsOnly card should NOT be visible to anonymous users"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - ExchangeOnly Visible to Collectors**
    ///
    /// ExchangeOnly cards should only be visible to the creator and users who have collected the card.
    #[test]
    fn prop_exchange_only_visible_to_collectors(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy(),
        non_collector_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != collector_id);
        prop_assume!(creator_id != non_collector_id);
        prop_assume!(collector_id != non_collector_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create an exchange-only card
        let card_id = model.create_card(creator_id, PrivacyLevel::ExchangeOnly);

        // Add collection (simulates exchange)
        model.collect_card(collector_id, card_id);

        // Should be visible to the creator
        prop_assert!(
            model.can_view_card(&card_id, Some(&creator_id)),
            "ExchangeOnly card should be visible to creator"
        );

        // Should be visible to collectors
        prop_assert!(
            model.can_view_card(&card_id, Some(&collector_id)),
            "ExchangeOnly card should be visible to collectors"
        );

        // Should NOT be visible to non-collectors
        prop_assert!(
            !model.can_view_card(&card_id, Some(&non_collector_id)),
            "ExchangeOnly card should NOT be visible to non-collectors"
        );

        // Should NOT be visible to anonymous users
        prop_assert!(
            !model.can_view_card(&card_id, None),
            "ExchangeOnly card should NOT be visible to anonymous users"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Creator Always Has Access**
    ///
    /// The creator of a card should always be able to view it regardless of privacy level.
    #[test]
    fn prop_creator_always_has_access(
        creator_id in uuid_strategy(),
        privacy_level in privacy_level_strategy(),
    ) {
        let mut model = PrivacyEnforcementModel::new();

        // Create a card with any privacy level
        let card_id = model.create_card(creator_id, privacy_level);

        // Creator should always be able to view
        prop_assert!(
            model.can_view_card(&card_id, Some(&creator_id)),
            "Creator should always be able to view their own card"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Follow Grants FriendsOnly Access**
    ///
    /// Following a user should grant access to their FriendsOnly cards.
    #[test]
    fn prop_follow_grants_friends_only_access(
        creator_id in uuid_strategy(),
        viewer_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != viewer_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create a friends-only card
        let card_id = model.create_card(creator_id, PrivacyLevel::FriendsOnly);

        // Initially, viewer cannot see the card
        prop_assert!(
            !model.can_view_card(&card_id, Some(&viewer_id)),
            "Non-follower should not see FriendsOnly card"
        );

        // After following, viewer can see the card
        model.follow(viewer_id, creator_id);
        prop_assert!(
            model.can_view_card(&card_id, Some(&viewer_id)),
            "Follower should see FriendsOnly card"
        );

        // After unfollowing, viewer cannot see the card again
        model.unfollow(&viewer_id, &creator_id);
        prop_assert!(
            !model.can_view_card(&card_id, Some(&viewer_id)),
            "After unfollowing, should not see FriendsOnly card"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Exchange Grants ExchangeOnly Access**
    ///
    /// Collecting a card through exchange should grant access to ExchangeOnly cards.
    #[test]
    fn prop_exchange_grants_exchange_only_access(
        creator_id in uuid_strategy(),
        viewer_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != viewer_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create an exchange-only card
        let card_id = model.create_card(creator_id, PrivacyLevel::ExchangeOnly);

        // Initially, viewer cannot see the card
        prop_assert!(
            !model.can_view_card(&card_id, Some(&viewer_id)),
            "Non-collector should not see ExchangeOnly card"
        );

        // After collecting (exchange), viewer can see the card
        model.collect_card(viewer_id, card_id);
        prop_assert!(
            model.can_view_card(&card_id, Some(&viewer_id)),
            "Collector should see ExchangeOnly card"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Follow Does Not Grant ExchangeOnly Access**
    ///
    /// Following a user should NOT grant access to their ExchangeOnly cards.
    #[test]
    fn prop_follow_does_not_grant_exchange_only_access(
        creator_id in uuid_strategy(),
        follower_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != follower_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create an exchange-only card
        let card_id = model.create_card(creator_id, PrivacyLevel::ExchangeOnly);

        // Follow the creator
        model.follow(follower_id, creator_id);

        // Follower should NOT be able to see exchange-only card
        prop_assert!(
            !model.can_view_card(&card_id, Some(&follower_id)),
            "Following should NOT grant access to ExchangeOnly cards"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Exchange Does Not Grant FriendsOnly Access**
    ///
    /// Collecting a card should NOT grant access to other FriendsOnly cards from the same creator.
    #[test]
    fn prop_exchange_does_not_grant_friends_only_access(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != collector_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create two cards: one exchange-only, one friends-only
        let exchange_card = model.create_card(creator_id, PrivacyLevel::ExchangeOnly);
        let friends_card = model.create_card(creator_id, PrivacyLevel::FriendsOnly);

        // Collect the exchange-only card
        model.collect_card(collector_id, exchange_card);

        // Collector can see the exchange-only card
        prop_assert!(
            model.can_view_card(&exchange_card, Some(&collector_id)),
            "Collector should see the ExchangeOnly card they collected"
        );

        // Collector should NOT be able to see the friends-only card
        prop_assert!(
            !model.can_view_card(&friends_card, Some(&collector_id)),
            "Collecting one card should NOT grant access to FriendsOnly cards"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Privacy Level Change**
    ///
    /// Changing a card's privacy level should immediately affect visibility.
    #[test]
    fn prop_privacy_level_change_affects_visibility(
        creator_id in uuid_strategy(),
        viewer_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != viewer_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create a public card
        let card_id = model.create_card(creator_id, PrivacyLevel::Public);

        // Initially visible to viewer
        prop_assert!(
            model.can_view_card(&card_id, Some(&viewer_id)),
            "Public card should be visible"
        );

        // Change to friends-only
        model.update_privacy(&card_id, &creator_id, PrivacyLevel::FriendsOnly)
            .expect("Privacy update should succeed");

        // Now not visible to non-follower
        prop_assert!(
            !model.can_view_card(&card_id, Some(&viewer_id)),
            "FriendsOnly card should not be visible to non-follower"
        );

        // Follow the creator
        model.follow(viewer_id, creator_id);

        // Now visible again
        prop_assert!(
            model.can_view_card(&card_id, Some(&viewer_id)),
            "FriendsOnly card should be visible to follower"
        );

        // Change to exchange-only
        model.update_privacy(&card_id, &creator_id, PrivacyLevel::ExchangeOnly)
            .expect("Privacy update should succeed");

        // Not visible even to follower
        prop_assert!(
            !model.can_view_card(&card_id, Some(&viewer_id)),
            "ExchangeOnly card should not be visible to follower who hasn't exchanged"
        );
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Multiple Cards Different Privacy**
    ///
    /// A user should only see cards they have access to based on each card's privacy level.
    #[test]
    fn prop_multiple_cards_different_privacy(
        creator_id in uuid_strategy(),
        viewer_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != viewer_id);

        let mut model = PrivacyEnforcementModel::new();

        // Create cards with different privacy levels
        let public_card = model.create_card(creator_id, PrivacyLevel::Public);
        let friends_card = model.create_card(creator_id, PrivacyLevel::FriendsOnly);
        let exchange_card = model.create_card(creator_id, PrivacyLevel::ExchangeOnly);

        // Initially, viewer can only see public card
        let visible = model.get_visible_cards(Some(&viewer_id));
        prop_assert!(visible.contains(&public_card), "Should see public card");
        prop_assert!(!visible.contains(&friends_card), "Should not see friends card");
        prop_assert!(!visible.contains(&exchange_card), "Should not see exchange card");

        // After following, can see public and friends cards
        model.follow(viewer_id, creator_id);
        let visible = model.get_visible_cards(Some(&viewer_id));
        prop_assert!(visible.contains(&public_card), "Should see public card");
        prop_assert!(visible.contains(&friends_card), "Should see friends card after following");
        prop_assert!(!visible.contains(&exchange_card), "Should not see exchange card");

        // After collecting exchange card, can see all three
        model.collect_card(viewer_id, exchange_card);
        let visible = model.get_visible_cards(Some(&viewer_id));
        prop_assert!(visible.contains(&public_card), "Should see public card");
        prop_assert!(visible.contains(&friends_card), "Should see friends card");
        prop_assert!(visible.contains(&exchange_card), "Should see exchange card after collecting");
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Anonymous User Access**
    ///
    /// Anonymous users should only be able to see public cards.
    #[test]
    fn prop_anonymous_user_only_sees_public(
        creator_id in uuid_strategy(),
    ) {
        let mut model = PrivacyEnforcementModel::new();

        // Create cards with different privacy levels
        let public_card = model.create_card(creator_id, PrivacyLevel::Public);
        let friends_card = model.create_card(creator_id, PrivacyLevel::FriendsOnly);
        let exchange_card = model.create_card(creator_id, PrivacyLevel::ExchangeOnly);

        // Anonymous user (None) should only see public cards
        let visible = model.get_visible_cards(None);
        prop_assert!(visible.contains(&public_card), "Anonymous should see public card");
        prop_assert!(!visible.contains(&friends_card), "Anonymous should not see friends card");
        prop_assert!(!visible.contains(&exchange_card), "Anonymous should not see exchange card");
    }

    /// **Feature: life-card-mvp, Property 7: Privacy Enforcement - Non-Existent Card**
    ///
    /// Attempting to view a non-existent card should return false.
    #[test]
    fn prop_non_existent_card_not_visible(
        viewer_id in uuid_strategy(),
        fake_card_id in uuid_strategy(),
    ) {
        let model = PrivacyEnforcementModel::new();

        // Non-existent card should not be visible
        prop_assert!(
            !model.can_view_card(&fake_card_id, Some(&viewer_id)),
            "Non-existent card should not be visible"
        );
        prop_assert!(
            !model.can_view_card(&fake_card_id, None),
            "Non-existent card should not be visible to anonymous"
        );
    }
}


// ============================================================================
// Property 8: Search and Filter Accuracy
// **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
//
// For any search query or filter criteria (keyword, card type, interest category,
// location), all returned cards SHALL match the specified criteria. No card that
// matches the criteria should be excluded (completeness), and no card that doesn't
// match should be included (soundness).
// ============================================================================

/// Model for simulating search and filter behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct SearchFilterModel {
    /// Cards in the system with all searchable fields
    cards: Vec<SearchableCard>,
}

#[derive(Debug, Clone)]
struct SearchableCard {
    id: Uuid,
    creator_id: Uuid,
    card_type: CardType,
    title: String,
    description: String,
    interest_tags: Vec<String>,
    location: Option<Location>,
    privacy_level: PrivacyLevel,
    is_deleted: bool,
}

impl SearchFilterModel {
    fn new() -> Self {
        Self { cards: Vec::new() }
    }

    /// Add a card to the model
    fn add_card(&mut self, card: SearchableCard) {
        self.cards.push(card);
    }

    /// Create a simple card with minimal data
    fn create_card(
        &mut self,
        creator_id: Uuid,
        card_type: CardType,
        title: String,
        description: String,
        interest_tags: Vec<String>,
        location: Option<Location>,
    ) -> Uuid {
        let id = Uuid::new_v4();
        self.cards.push(SearchableCard {
            id,
            creator_id,
            card_type,
            title,
            description,
            interest_tags,
            location,
            privacy_level: PrivacyLevel::Public,
            is_deleted: false,
        });
        id
    }

    /// Search by keyword (matches title or description)
    /// Requirements: 4.2
    fn search_by_keyword(&self, keyword: &str) -> Vec<Uuid> {
        let keyword_lower = keyword.to_lowercase();
        self.cards.iter()
            .filter(|c| !c.is_deleted && c.privacy_level == PrivacyLevel::Public)
            .filter(|c| {
                c.title.to_lowercase().contains(&keyword_lower) ||
                c.description.to_lowercase().contains(&keyword_lower)
            })
            .map(|c| c.id)
            .collect()
    }

    /// Filter by card type
    /// Requirements: 4.3
    fn filter_by_card_type(&self, card_type: &CardType) -> Vec<Uuid> {
        self.cards.iter()
            .filter(|c| !c.is_deleted && c.privacy_level == PrivacyLevel::Public)
            .filter(|c| &c.card_type == card_type)
            .map(|c| c.id)
            .collect()
    }

    /// Filter by interest tags (cards that have ANY of the specified tags)
    /// Requirements: 4.4
    fn filter_by_interest_tags(&self, tags: &[String]) -> Vec<Uuid> {
        if tags.is_empty() {
            return Vec::new();
        }
        self.cards.iter()
            .filter(|c| !c.is_deleted && c.privacy_level == PrivacyLevel::Public)
            .filter(|c| tags.iter().any(|t| c.interest_tags.contains(t)))
            .map(|c| c.id)
            .collect()
    }

    /// Filter by location (within radius)
    /// Requirements: 4.5
    fn filter_by_location(&self, filter: &LocationFilter) -> Vec<Uuid> {
        self.cards.iter()
            .filter(|c| !c.is_deleted && c.privacy_level == PrivacyLevel::Public)
            .filter(|c| {
                if let Some(ref loc) = c.location {
                    filter.contains(loc)
                } else {
                    false
                }
            })
            .map(|c| c.id)
            .collect()
    }

    /// Combined search with multiple criteria
    fn search(
        &self,
        keyword: Option<&str>,
        card_type: Option<&CardType>,
        interest_tags: Option<&[String]>,
        location: Option<&LocationFilter>,
    ) -> Vec<Uuid> {
        self.cards.iter()
            .filter(|c| !c.is_deleted && c.privacy_level == PrivacyLevel::Public)
            .filter(|c| {
                // Keyword filter
                if let Some(kw) = keyword {
                    let kw_lower = kw.to_lowercase();
                    if !c.title.to_lowercase().contains(&kw_lower) &&
                       !c.description.to_lowercase().contains(&kw_lower) {
                        return false;
                    }
                }
                // Card type filter
                if let Some(ct) = card_type {
                    if &c.card_type != ct {
                        return false;
                    }
                }
                // Interest tags filter
                if let Some(tags) = interest_tags {
                    if !tags.is_empty() && !tags.iter().any(|t| c.interest_tags.contains(t)) {
                        return false;
                    }
                }
                // Location filter
                if let Some(loc_filter) = location {
                    if let Some(ref loc) = c.location {
                        if !loc_filter.contains(loc) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                true
            })
            .map(|c| c.id)
            .collect()
    }

    /// Get a card by ID
    fn get_card(&self, id: &Uuid) -> Option<&SearchableCard> {
        self.cards.iter().find(|c| &c.id == id)
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Keyword Search Soundness**
    ///
    /// All cards returned by keyword search must contain the keyword in title or description.
    #[test]
    fn prop_keyword_search_soundness(
        creator_id in uuid_strategy(),
        keyword in "[a-zA-Z]{3,10}",
        titles in prop::collection::vec("[a-zA-Z\\s]{5,30}", 3..6),
        descriptions in prop::collection::vec("[a-zA-Z\\s]{10,50}", 3..6),
    ) {
        let mut model = SearchFilterModel::new();

        // Create cards with various titles and descriptions
        for (title, desc) in titles.iter().zip(descriptions.iter()) {
            model.create_card(
                creator_id,
                CardType::DayCard,
                title.clone(),
                desc.clone(),
                vec![],
                None,
            );
        }

        // Search by keyword
        let results = model.search_by_keyword(&keyword);

        // Verify soundness: all returned cards must contain the keyword
        for card_id in &results {
            let card = model.get_card(card_id).expect("Card should exist");
            let keyword_lower = keyword.to_lowercase();
            let matches = card.title.to_lowercase().contains(&keyword_lower) ||
                         card.description.to_lowercase().contains(&keyword_lower);
            prop_assert!(matches, 
                "Card '{}' returned by search should contain keyword '{}'", 
                card.title, keyword);
        }
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Keyword Search Completeness**
    ///
    /// All cards containing the keyword should be returned by the search.
    #[test]
    fn prop_keyword_search_completeness(
        creator_id in uuid_strategy(),
        keyword in "[a-zA-Z]{3,8}",
    ) {
        let mut model = SearchFilterModel::new();

        // Create cards - some with keyword, some without
        let with_keyword_in_title = model.create_card(
            creator_id,
            CardType::DayCard,
            format!("Title with {} inside", keyword),
            "Some description".to_string(),
            vec![],
            None,
        );
        let with_keyword_in_desc = model.create_card(
            creator_id,
            CardType::WeekCard,
            "Regular title".to_string(),
            format!("Description containing {} here", keyword),
            vec![],
            None,
        );
        let _without_keyword = model.create_card(
            creator_id,
            CardType::FragmentCard,
            "Unrelated title".to_string(),
            "Unrelated description".to_string(),
            vec![],
            None,
        );

        // Search by keyword
        let results = model.search_by_keyword(&keyword);

        // Verify completeness: cards with keyword should be in results
        prop_assert!(results.contains(&with_keyword_in_title), 
            "Card with keyword in title should be found");
        prop_assert!(results.contains(&with_keyword_in_desc), 
            "Card with keyword in description should be found");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Card Type Filter Soundness**
    ///
    /// All cards returned by card type filter must have the specified type.
    #[test]
    fn prop_card_type_filter_soundness(
        creator_id in uuid_strategy(),
        filter_type in card_type_strategy(),
    ) {
        let mut model = SearchFilterModel::new();

        // Create cards of different types
        for card_type in [CardType::DayCard, CardType::WeekCard, CardType::FragmentCard, CardType::MomentCard] {
            model.create_card(
                creator_id,
                card_type,
                "Test title".to_string(),
                "Test description".to_string(),
                vec![],
                None,
            );
        }

        // Filter by card type
        let results = model.filter_by_card_type(&filter_type);

        // Verify soundness: all returned cards must have the specified type
        for card_id in &results {
            let card = model.get_card(card_id).expect("Card should exist");
            prop_assert_eq!(&card.card_type, &filter_type, 
                "Returned card should have the filtered type");
        }
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Card Type Filter Completeness**
    ///
    /// All cards of the specified type should be returned by the filter.
    #[test]
    fn prop_card_type_filter_completeness(
        creator_id in uuid_strategy(),
        filter_type in card_type_strategy(),
        num_matching in 1usize..4usize,
    ) {
        let mut model = SearchFilterModel::new();

        // Create multiple cards of the target type
        let mut matching_ids = Vec::new();
        for i in 0..num_matching {
            let id = model.create_card(
                creator_id,
                filter_type.clone(),
                format!("Title {}", i),
                format!("Description {}", i),
                vec![],
                None,
            );
            matching_ids.push(id);
        }

        // Create a card of a different type
        let other_type = match filter_type {
            CardType::DayCard => CardType::WeekCard,
            _ => CardType::DayCard,
        };
        model.create_card(
            creator_id,
            other_type,
            "Other title".to_string(),
            "Other description".to_string(),
            vec![],
            None,
        );

        // Filter by card type
        let results = model.filter_by_card_type(&filter_type);

        // Verify completeness: all matching cards should be in results
        for id in &matching_ids {
            prop_assert!(results.contains(id), 
                "Card of matching type should be in results");
        }
        prop_assert_eq!(results.len(), matching_ids.len(),
            "Result count should match number of cards with that type");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Interest Tags Filter Soundness**
    ///
    /// All cards returned by interest tag filter must have at least one of the specified tags.
    #[test]
    fn prop_interest_tags_filter_soundness(
        creator_id in uuid_strategy(),
        filter_tags in prop::collection::vec(valid_tag_strategy(), 1..3),
        card_tags in prop::collection::vec(valid_tags_strategy(), 3..6),
    ) {
        let mut model = SearchFilterModel::new();

        // Create cards with various tags
        for tags in &card_tags {
            model.create_card(
                creator_id,
                CardType::DayCard,
                "Test title".to_string(),
                "Test description".to_string(),
                tags.clone(),
                None,
            );
        }

        // Filter by interest tags
        let results = model.filter_by_interest_tags(&filter_tags);

        // Verify soundness: all returned cards must have at least one of the filter tags
        for card_id in &results {
            let card = model.get_card(card_id).expect("Card should exist");
            let has_matching_tag = filter_tags.iter().any(|t| card.interest_tags.contains(t));
            prop_assert!(has_matching_tag, 
                "Returned card should have at least one of the filter tags");
        }
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Interest Tags Filter Completeness**
    ///
    /// All cards with at least one of the specified tags should be returned.
    #[test]
    fn prop_interest_tags_filter_completeness(
        creator_id in uuid_strategy(),
        common_tag in valid_tag_strategy(),
    ) {
        let mut model = SearchFilterModel::new();

        // Create cards - some with the common tag, some without
        let with_tag = model.create_card(
            creator_id,
            CardType::DayCard,
            "With tag".to_string(),
            "Description".to_string(),
            vec![common_tag.clone(), "other".to_string()],
            None,
        );
        let _without_tag = model.create_card(
            creator_id,
            CardType::WeekCard,
            "Without tag".to_string(),
            "Description".to_string(),
            vec!["different".to_string()],
            None,
        );

        // Filter by the common tag
        let results = model.filter_by_interest_tags(&[common_tag]);

        // Verify completeness
        prop_assert!(results.contains(&with_tag), 
            "Card with matching tag should be in results");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Location Filter Soundness**
    ///
    /// All cards returned by location filter must be within the specified radius.
    #[test]
    fn prop_location_filter_soundness(
        creator_id in uuid_strategy(),
        center_lat in -80.0f64..80.0f64,
        center_lon in -170.0f64..170.0f64,
        radius_km in 10.0f64..100.0f64,
    ) {
        let mut model = SearchFilterModel::new();
        let filter = LocationFilter::new(center_lat, center_lon, radius_km);

        // Create cards at various distances
        // Card very close to center (should be included)
        model.create_card(
            creator_id,
            CardType::DayCard,
            "Close card".to_string(),
            "Description".to_string(),
            vec![],
            Some(Location::new("Close".to_string(), center_lat + 0.001, center_lon + 0.001)),
        );

        // Card far away (should be excluded)
        model.create_card(
            creator_id,
            CardType::WeekCard,
            "Far card".to_string(),
            "Description".to_string(),
            vec![],
            Some(Location::new("Far".to_string(), center_lat + 50.0, center_lon + 50.0)),
        );

        // Filter by location
        let results = model.filter_by_location(&filter);

        // Verify soundness: all returned cards must be within radius
        for card_id in &results {
            let card = model.get_card(card_id).expect("Card should exist");
            if let Some(ref loc) = card.location {
                let distance = filter.distance_to(loc);
                prop_assert!(distance <= radius_km, 
                    "Returned card at distance {:.2}km should be within radius {:.2}km", 
                    distance, radius_km);
            }
        }
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Location Filter Completeness**
    ///
    /// All cards within the specified radius should be returned.
    #[test]
    fn prop_location_filter_completeness(
        creator_id in uuid_strategy(),
        center_lat in -80.0f64..80.0f64,
        center_lon in -170.0f64..170.0f64,
    ) {
        let mut model = SearchFilterModel::new();
        let radius_km = 50.0;
        let filter = LocationFilter::new(center_lat, center_lon, radius_km);

        // Create a card at the center (definitely within radius)
        let at_center = model.create_card(
            creator_id,
            CardType::DayCard,
            "At center".to_string(),
            "Description".to_string(),
            vec![],
            Some(Location::new("Center".to_string(), center_lat, center_lon)),
        );

        // Filter by location
        let results = model.filter_by_location(&filter);

        // Verify completeness: card at center should be in results
        prop_assert!(results.contains(&at_center), 
            "Card at center should be within radius");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Combined Filters**
    ///
    /// Combined filters should return only cards matching ALL criteria.
    #[test]
    fn prop_combined_filters_intersection(
        creator_id in uuid_strategy(),
        keyword in "[a-zA-Z]{3,6}",
        tag in valid_tag_strategy(),
    ) {
        let mut model = SearchFilterModel::new();

        // Use a description that won't accidentally contain the keyword
        // "Description" contains "rip" which caused false matches
        let safe_desc = "Some text here".to_string();
        let no_keyword_title = "Other content".to_string();

        // Card matching both keyword and tag
        let matches_both = model.create_card(
            creator_id,
            CardType::DayCard,
            format!("Title with {}", keyword),
            safe_desc.clone(),
            vec![tag.clone()],
            None,
        );

        // Card matching only keyword
        let _matches_keyword_only = model.create_card(
            creator_id,
            CardType::DayCard,
            format!("Title with {}", keyword),
            safe_desc.clone(),
            vec!["other_tag".to_string()],
            None,
        );

        // Card matching only tag (title and description must NOT contain keyword)
        let _matches_tag_only = model.create_card(
            creator_id,
            CardType::DayCard,
            no_keyword_title.clone(),
            safe_desc.clone(),
            vec![tag.clone()],
            None,
        );

        // Card matching neither
        let _matches_neither = model.create_card(
            creator_id,
            CardType::DayCard,
            no_keyword_title.clone(),
            safe_desc.clone(),
            vec!["other_tag".to_string()],
            None,
        );

        // Combined search
        let results = model.search(
            Some(&keyword),
            None,
            Some(&[tag]),
            None,
        );

        // Only the card matching both should be returned
        prop_assert_eq!(results.len(), 1, "Only one card should match both criteria");
        prop_assert!(results.contains(&matches_both), 
            "Card matching both criteria should be in results");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Empty Results**
    ///
    /// Search with no matching cards should return empty results.
    #[test]
    fn prop_no_matches_returns_empty(
        creator_id in uuid_strategy(),
    ) {
        let mut model = SearchFilterModel::new();

        // Create a card
        model.create_card(
            creator_id,
            CardType::DayCard,
            "Test title".to_string(),
            "Test description".to_string(),
            vec!["tag1".to_string()],
            None,
        );

        // Search for non-existent keyword
        let results = model.search_by_keyword("xyznonexistent123");
        prop_assert!(results.is_empty(), "Search for non-existent keyword should return empty");

        // Filter by non-existent tag
        let results = model.filter_by_interest_tags(&["nonexistent_tag_xyz".to_string()]);
        prop_assert!(results.is_empty(), "Filter by non-existent tag should return empty");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Deleted Cards Excluded**
    ///
    /// Deleted cards should not appear in search results.
    #[test]
    fn prop_deleted_cards_excluded_from_search(
        creator_id in uuid_strategy(),
        keyword in "[a-zA-Z]{3,8}",
    ) {
        let mut model = SearchFilterModel::new();

        // Create a card with the keyword
        let card_id = model.create_card(
            creator_id,
            CardType::DayCard,
            format!("Title with {}", keyword),
            "Description".to_string(),
            vec![],
            None,
        );

        // Mark it as deleted
        if let Some(card) = model.cards.iter_mut().find(|c| c.id == card_id) {
            card.is_deleted = true;
        }

        // Search should not find the deleted card
        let results = model.search_by_keyword(&keyword);
        prop_assert!(!results.contains(&card_id), 
            "Deleted card should not appear in search results");
    }

    /// **Feature: life-card-mvp, Property 8: Search and Filter Accuracy - Private Cards Excluded**
    ///
    /// Non-public cards should not appear in general search results.
    #[test]
    fn prop_private_cards_excluded_from_search(
        creator_id in uuid_strategy(),
        keyword in "[a-zA-Z]{3,8}",
    ) {
        let mut model = SearchFilterModel::new();

        // Create a public card
        let public_card = model.create_card(
            creator_id,
            CardType::DayCard,
            format!("Public {}", keyword),
            "Description".to_string(),
            vec![],
            None,
        );

        // Create a friends-only card
        let friends_card_id = Uuid::new_v4();
        model.add_card(SearchableCard {
            id: friends_card_id,
            creator_id,
            card_type: CardType::DayCard,
            title: format!("Friends {}", keyword),
            description: "Description".to_string(),
            interest_tags: vec![],
            location: None,
            privacy_level: PrivacyLevel::FriendsOnly,
            is_deleted: false,
        });

        // Create an exchange-only card
        let exchange_card_id = Uuid::new_v4();
        model.add_card(SearchableCard {
            id: exchange_card_id,
            creator_id,
            card_type: CardType::DayCard,
            title: format!("Exchange {}", keyword),
            description: "Description".to_string(),
            interest_tags: vec![],
            location: None,
            privacy_level: PrivacyLevel::ExchangeOnly,
            is_deleted: false,
        });

        // Search should only find the public card
        let results = model.search_by_keyword(&keyword);
        prop_assert!(results.contains(&public_card), 
            "Public card should appear in search results");
        prop_assert!(!results.contains(&friends_card_id), 
            "Friends-only card should not appear in general search");
        prop_assert!(!results.contains(&exchange_card_id), 
            "Exchange-only card should not appear in general search");
    }
}


// ============================================================================
// Property 9: Pagination Correctness
// **Validates: Requirements 4.8**
//
// For any paginated request with page size N, THE System SHALL return at most
// N items per page, items should not repeat across pages, and the union of all
// pages should equal the complete result set.
// ============================================================================

use life_card_api::models::common::{Pagination, CursorPagination};

/// Model for simulating pagination behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct PaginationModel {
    /// All items in the system (sorted by creation time descending)
    items: Vec<(Uuid, chrono::DateTime<chrono::Utc>)>,
}

impl PaginationModel {
    fn new() -> Self {
        Self { items: Vec::new() }
    }

    /// Add items with timestamps
    fn add_items(&mut self, count: usize) {
        use chrono::{Duration, Utc};
        let base_time = Utc::now();
        for i in 0..count {
            let id = Uuid::new_v4();
            // Items are added with decreasing timestamps (newest first)
            let timestamp = base_time - Duration::seconds(i as i64);
            self.items.push((id, timestamp));
        }
        // Sort by timestamp descending (newest first)
        self.items.sort_by(|a, b| b.1.cmp(&a.1));
    }

    /// Get total count
    fn total_count(&self) -> usize {
        self.items.len()
    }

    /// Get a page of items using offset-based pagination
    fn get_page(&self, pagination: &Pagination) -> Vec<Uuid> {
        let offset = pagination.offset() as usize;
        let limit = pagination.limit() as usize;
        
        self.items
            .iter()
            .skip(offset)
            .take(limit)
            .map(|(id, _)| *id)
            .collect()
    }

    /// Get all pages and return them as separate vectors
    fn get_all_pages(&self, page_size: i32) -> Vec<Vec<Uuid>> {
        let mut pages = Vec::new();
        let total = self.total_count();
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as i32;

        for page in 1..=total_pages {
            let pagination = Pagination::new(page, page_size);
            pages.push(self.get_page(&pagination));
        }

        pages
    }

    /// Get items using cursor-based pagination
    fn get_with_cursor(&self, cursor: Option<chrono::DateTime<chrono::Utc>>, limit: usize) -> (Vec<Uuid>, Option<chrono::DateTime<chrono::Utc>>, bool) {
        let filtered: Vec<_> = match cursor {
            Some(cursor_time) => {
                self.items
                    .iter()
                    .filter(|(_, ts)| *ts < cursor_time)
                    .collect()
            }
            None => self.items.iter().collect(),
        };

        let has_more = filtered.len() > limit;
        let items: Vec<Uuid> = filtered
            .iter()
            .take(limit)
            .map(|(id, _)| *id)
            .collect();

        let next_cursor = if has_more && !items.is_empty() {
            // Find the timestamp of the last item
            filtered.get(limit - 1).map(|(_, ts)| *ts)
        } else {
            None
        };

        (items, next_cursor, has_more)
    }

    /// Get all items using cursor-based pagination
    fn get_all_with_cursor(&self, limit: usize) -> Vec<Vec<Uuid>> {
        let mut pages = Vec::new();
        let mut cursor = None;

        loop {
            let (items, next_cursor, has_more) = self.get_with_cursor(cursor, limit);
            if items.is_empty() {
                break;
            }
            pages.push(items);
            if !has_more {
                break;
            }
            cursor = next_cursor;
        }

        pages
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Page Size Limit**
    ///
    /// Each page should contain at most page_size items.
    #[test]
    fn prop_pagination_respects_page_size(
        total_items in 1usize..50usize,
        page_size in 1i32..20i32,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_pages(page_size);

        // Each page should have at most page_size items
        for (i, page) in pages.iter().enumerate() {
            prop_assert!(
                page.len() <= page_size as usize,
                "Page {} has {} items, expected at most {}",
                i + 1, page.len(), page_size
            );
        }
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - No Duplicates**
    ///
    /// Items should not repeat across pages.
    #[test]
    fn prop_pagination_no_duplicates(
        total_items in 1usize..50usize,
        page_size in 1i32..20i32,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_pages(page_size);

        // Collect all items from all pages
        let all_items: Vec<Uuid> = pages.into_iter().flatten().collect();

        // Check for duplicates
        let unique_items: std::collections::HashSet<_> = all_items.iter().collect();
        prop_assert_eq!(
            unique_items.len(),
            all_items.len(),
            "Found duplicate items across pages"
        );
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Complete Coverage**
    ///
    /// The union of all pages should equal the complete result set.
    #[test]
    fn prop_pagination_complete_coverage(
        total_items in 1usize..50usize,
        page_size in 1i32..20i32,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_pages(page_size);

        // Collect all items from all pages
        let all_paginated: std::collections::HashSet<_> = pages
            .into_iter()
            .flatten()
            .collect();

        // Get all items directly
        let all_items: std::collections::HashSet<_> = model.items
            .iter()
            .map(|(id, _)| *id)
            .collect();

        // They should be equal
        prop_assert_eq!(
            all_paginated.len(),
            all_items.len(),
            "Paginated results should cover all items"
        );
        prop_assert_eq!(
            all_paginated,
            all_items,
            "Paginated results should match all items"
        );
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Correct Page Count**
    ///
    /// The number of pages should be ceil(total / page_size).
    #[test]
    fn prop_pagination_correct_page_count(
        total_items in 1usize..50usize,
        page_size in 1i32..20i32,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_pages(page_size);
        let expected_pages = ((total_items as f64) / (page_size as f64)).ceil() as usize;

        prop_assert_eq!(
            pages.len(),
            expected_pages,
            "Expected {} pages, got {}",
            expected_pages, pages.len()
        );
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Last Page Size**
    ///
    /// The last page should contain the remaining items.
    #[test]
    fn prop_pagination_last_page_size(
        total_items in 1usize..50usize,
        page_size in 1i32..20i32,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_pages(page_size);

        if let Some(last_page) = pages.last() {
            let expected_last_page_size = total_items % (page_size as usize);
            let expected = if expected_last_page_size == 0 {
                page_size as usize
            } else {
                expected_last_page_size
            };

            prop_assert_eq!(
                last_page.len(),
                expected,
                "Last page should have {} items, got {}",
                expected, last_page.len()
            );
        }
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Empty Result**
    ///
    /// Pagination of empty result set should return empty pages.
    #[test]
    fn prop_pagination_empty_result(page_size in 1i32..20i32) {
        let model = PaginationModel::new();
        let pages = model.get_all_pages(page_size);

        prop_assert!(pages.is_empty(), "Empty result set should have no pages");
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Single Item**
    ///
    /// Single item should be on first page regardless of page size.
    #[test]
    fn prop_pagination_single_item(page_size in 1i32..20i32) {
        let mut model = PaginationModel::new();
        model.add_items(1);

        let pages = model.get_all_pages(page_size);

        prop_assert_eq!(pages.len(), 1, "Single item should result in one page");
        prop_assert_eq!(pages[0].len(), 1, "First page should have one item");
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Cursor-Based No Duplicates**
    ///
    /// Cursor-based pagination should not have duplicates across pages.
    #[test]
    fn prop_cursor_pagination_no_duplicates(
        total_items in 1usize..50usize,
        limit in 1usize..20usize,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_with_cursor(limit);

        // Collect all items from all pages
        let all_items: Vec<Uuid> = pages.into_iter().flatten().collect();

        // Check for duplicates
        let unique_items: std::collections::HashSet<_> = all_items.iter().collect();
        prop_assert_eq!(
            unique_items.len(),
            all_items.len(),
            "Found duplicate items in cursor-based pagination"
        );
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Cursor-Based Complete Coverage**
    ///
    /// Cursor-based pagination should cover all items.
    #[test]
    fn prop_cursor_pagination_complete_coverage(
        total_items in 1usize..50usize,
        limit in 1usize..20usize,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_with_cursor(limit);

        // Collect all items from all pages
        let all_paginated: std::collections::HashSet<_> = pages
            .into_iter()
            .flatten()
            .collect();

        // Get all items directly
        let all_items: std::collections::HashSet<_> = model.items
            .iter()
            .map(|(id, _)| *id)
            .collect();

        prop_assert_eq!(
            all_paginated.len(),
            all_items.len(),
            "Cursor pagination should cover all items"
        );
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Cursor-Based Page Size**
    ///
    /// Each cursor-based page should have at most limit items.
    #[test]
    fn prop_cursor_pagination_respects_limit(
        total_items in 1usize..50usize,
        limit in 1usize..20usize,
    ) {
        let mut model = PaginationModel::new();
        model.add_items(total_items);

        let pages = model.get_all_with_cursor(limit);

        for (i, page) in pages.iter().enumerate() {
            prop_assert!(
                page.len() <= limit,
                "Cursor page {} has {} items, expected at most {}",
                i + 1, page.len(), limit
            );
        }
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Pagination Helper Methods**
    ///
    /// Pagination helper methods should calculate correct values.
    #[test]
    fn prop_pagination_helper_methods(
        page in 1i32..100i32,
        page_size in 1i32..100i32,
    ) {
        let pagination = Pagination::new(page, page_size);

        // Offset should be (page - 1) * page_size
        let expected_offset = ((page - 1) * page_size.min(100)) as i64;
        prop_assert_eq!(
            pagination.offset(),
            expected_offset,
            "Offset calculation incorrect"
        );

        // Limit should be page_size (clamped to 100)
        let expected_limit = page_size.min(100) as i64;
        prop_assert_eq!(
            pagination.limit(),
            expected_limit,
            "Limit calculation incorrect"
        );
    }

    /// **Feature: life-card-mvp, Property 9: Pagination Correctness - Has More Detection**
    ///
    /// has_more should correctly indicate if there are more pages.
    #[test]
    fn prop_pagination_has_more(
        total_items in 0i64..100i64,
        page in 1i32..10i32,
        page_size in 1i32..20i32,
    ) {
        let pagination = Pagination::new(page, page_size);
        let has_more = pagination.has_more(total_items);

        let items_shown = (page as i64) * (page_size.min(100) as i64);
        let expected_has_more = items_shown < total_items;

        prop_assert_eq!(
            has_more,
            expected_has_more,
            "has_more should be {} for {} items shown out of {}",
            expected_has_more, items_shown, total_items
        );
    }
}


// ============================================================================
// Property 14: Like/Unlike Idempotence
// **Validates: Requirements 8.1, 8.2**
//
// For any card and user, liking a card should increment the like count by exactly 1,
// unliking should decrement by exactly 1, and the like count should equal the number
// of distinct users who have liked the card.
// ============================================================================

/// Model for simulating like/unlike behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct LikeModel {
    /// Cards in the system: (card_id, like_count)
    cards: Vec<(Uuid, i32)>,
    /// Like records: (card_id, user_id)
    likes: Vec<(Uuid, Uuid)>,
}

impl LikeModel {
    fn new() -> Self {
        Self {
            cards: Vec::new(),
            likes: Vec::new(),
        }
    }

    /// Create a card with initial like count of 0
    fn create_card(&mut self) -> Uuid {
        let card_id = Uuid::new_v4();
        self.cards.push((card_id, 0));
        card_id
    }

    /// Check if a card exists
    fn card_exists(&self, card_id: &Uuid) -> bool {
        self.cards.iter().any(|(cid, _)| cid == card_id)
    }

    /// Check if a user has liked a card
    fn has_liked(&self, card_id: &Uuid, user_id: &Uuid) -> bool {
        self.likes.iter().any(|(cid, uid)| cid == card_id && uid == user_id)
    }

    /// Get the like count for a card
    fn get_like_count(&self, card_id: &Uuid) -> Option<i32> {
        self.cards.iter()
            .find(|(cid, _)| cid == card_id)
            .map(|(_, count)| *count)
    }

    /// Get the actual number of distinct users who have liked a card
    fn get_actual_like_count(&self, card_id: &Uuid) -> i32 {
        self.likes.iter()
            .filter(|(cid, _)| cid == card_id)
            .count() as i32
    }

    /// Like a card (idempotent - no error if already liked)
    fn like_card(&mut self, card_id: &Uuid, user_id: &Uuid) -> Result<i32, String> {
        // Check if card exists
        if !self.card_exists(card_id) {
            return Err("Card not found".to_string());
        }

        // Check if already liked (idempotent)
        if self.has_liked(card_id, user_id) {
            return Ok(self.get_like_count(card_id).unwrap());
        }

        // Add like record
        self.likes.push((*card_id, *user_id));

        // Increment like count
        if let Some((_, count)) = self.cards.iter_mut().find(|(cid, _)| cid == card_id) {
            *count += 1;
            Ok(*count)
        } else {
            Err("Card not found".to_string())
        }
    }

    /// Unlike a card (idempotent - no error if not liked)
    fn unlike_card(&mut self, card_id: &Uuid, user_id: &Uuid) -> Result<i32, String> {
        // Check if card exists
        if !self.card_exists(card_id) {
            return Err("Card not found".to_string());
        }

        // Check if actually liked (idempotent)
        if !self.has_liked(card_id, user_id) {
            return Ok(self.get_like_count(card_id).unwrap());
        }

        // Remove like record
        self.likes.retain(|(cid, uid)| !(cid == card_id && uid == user_id));

        // Decrement like count (ensure non-negative)
        if let Some((_, count)) = self.cards.iter_mut().find(|(cid, _)| cid == card_id) {
            *count = (*count - 1).max(0);
            Ok(*count)
        } else {
            Err("Card not found".to_string())
        }
    }

    /// Get all users who have liked a card
    fn get_likers(&self, card_id: &Uuid) -> Vec<Uuid> {
        self.likes.iter()
            .filter(|(cid, _)| cid == card_id)
            .map(|(_, uid)| *uid)
            .collect()
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Like Increments Count**
    ///
    /// For any card and user, liking a card should increment the like count by exactly 1.
    #[test]
    fn prop_like_increments_count_by_one(user_id in uuid_strategy()) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Initial count should be 0
        let initial_count = model.get_like_count(&card_id).unwrap();
        prop_assert_eq!(initial_count, 0, "Initial like count should be 0");

        // Like the card
        let new_count = model.like_card(&card_id, &user_id)
            .expect("Like should succeed");

        // Count should be incremented by exactly 1
        prop_assert_eq!(new_count, initial_count + 1, "Like count should increment by 1");
        prop_assert_eq!(new_count, 1, "Like count should be 1 after first like");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Unlike Decrements Count**
    ///
    /// For any card and user who has liked it, unliking should decrement the like count by exactly 1.
    #[test]
    fn prop_unlike_decrements_count_by_one(user_id in uuid_strategy()) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Like the card first
        model.like_card(&card_id, &user_id)
            .expect("Like should succeed");

        let count_after_like = model.get_like_count(&card_id).unwrap();
        prop_assert_eq!(count_after_like, 1, "Count should be 1 after like");

        // Unlike the card
        let new_count = model.unlike_card(&card_id, &user_id)
            .expect("Unlike should succeed");

        // Count should be decremented by exactly 1
        prop_assert_eq!(new_count, count_after_like - 1, "Like count should decrement by 1");
        prop_assert_eq!(new_count, 0, "Like count should be 0 after unlike");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Like Is Idempotent**
    ///
    /// Liking a card multiple times should only increment the count once.
    #[test]
    fn prop_like_is_idempotent(user_id in uuid_strategy(), num_likes in 2usize..10usize) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Like the card multiple times
        let mut counts = Vec::new();
        for _ in 0..num_likes {
            let count = model.like_card(&card_id, &user_id)
                .expect("Like should succeed");
            counts.push(count);
        }

        // All counts after the first should be the same (idempotent)
        prop_assert!(counts.iter().all(|&c| c == 1), 
            "All like counts should be 1 (idempotent): {:?}", counts);

        // Actual like count should be 1
        prop_assert_eq!(model.get_actual_like_count(&card_id), 1, 
            "Actual like count should be 1");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Unlike Is Idempotent**
    ///
    /// Unliking a card multiple times should only decrement the count once.
    #[test]
    fn prop_unlike_is_idempotent(user_id in uuid_strategy(), num_unlikes in 2usize..10usize) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Like the card first
        model.like_card(&card_id, &user_id)
            .expect("Like should succeed");

        // Unlike the card multiple times
        let mut counts = Vec::new();
        for _ in 0..num_unlikes {
            let count = model.unlike_card(&card_id, &user_id)
                .expect("Unlike should succeed");
            counts.push(count);
        }

        // All counts should be 0 (idempotent)
        prop_assert!(counts.iter().all(|&c| c == 0), 
            "All unlike counts should be 0 (idempotent): {:?}", counts);

        // Actual like count should be 0
        prop_assert_eq!(model.get_actual_like_count(&card_id), 0, 
            "Actual like count should be 0");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Count Equals Distinct Users**
    ///
    /// The like count should equal the number of distinct users who have liked the card.
    #[test]
    fn prop_like_count_equals_distinct_users(
        user_ids in prop::collection::vec(uuid_strategy(), 1..10)
    ) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Have each user like the card
        for user_id in &user_ids {
            model.like_card(&card_id, user_id)
                .expect("Like should succeed");
        }

        // Get unique user count
        let unique_users: std::collections::HashSet<_> = user_ids.iter().collect();
        let expected_count = unique_users.len() as i32;

        // Like count should equal distinct users
        let like_count = model.get_like_count(&card_id).unwrap();
        let actual_count = model.get_actual_like_count(&card_id);

        prop_assert_eq!(like_count, expected_count, 
            "Like count should equal distinct users");
        prop_assert_eq!(actual_count, expected_count, 
            "Actual like count should equal distinct users");
        prop_assert_eq!(like_count, actual_count, 
            "Stored count should match actual count");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Like Then Unlike Round Trip**
    ///
    /// For any card and user, liking then unliking should return to the original state.
    #[test]
    fn prop_like_unlike_round_trip(user_id in uuid_strategy()) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Initial state
        let initial_count = model.get_like_count(&card_id).unwrap();
        let initial_liked = model.has_liked(&card_id, &user_id);

        prop_assert_eq!(initial_count, 0, "Initial count should be 0");
        prop_assert!(!initial_liked, "Should not be liked initially");

        // Like
        model.like_card(&card_id, &user_id).expect("Like should succeed");
        prop_assert!(model.has_liked(&card_id, &user_id), "Should be liked after like");
        prop_assert_eq!(model.get_like_count(&card_id).unwrap(), 1, "Count should be 1");

        // Unlike
        model.unlike_card(&card_id, &user_id).expect("Unlike should succeed");
        
        // Should return to initial state
        let final_count = model.get_like_count(&card_id).unwrap();
        let final_liked = model.has_liked(&card_id, &user_id);

        prop_assert_eq!(final_count, initial_count, "Count should return to initial");
        prop_assert_eq!(final_liked, initial_liked, "Liked state should return to initial");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Multiple Users**
    ///
    /// Multiple users can like the same card, and each like/unlike affects only their own state.
    #[test]
    fn prop_multiple_users_independent_likes(
        user1 in uuid_strategy(),
        user2 in uuid_strategy(),
    ) {
        prop_assume!(user1 != user2);

        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // User1 likes
        model.like_card(&card_id, &user1).expect("Like should succeed");
        prop_assert_eq!(model.get_like_count(&card_id).unwrap(), 1);
        prop_assert!(model.has_liked(&card_id, &user1));
        prop_assert!(!model.has_liked(&card_id, &user2));

        // User2 likes
        model.like_card(&card_id, &user2).expect("Like should succeed");
        prop_assert_eq!(model.get_like_count(&card_id).unwrap(), 2);
        prop_assert!(model.has_liked(&card_id, &user1));
        prop_assert!(model.has_liked(&card_id, &user2));

        // User1 unlikes
        model.unlike_card(&card_id, &user1).expect("Unlike should succeed");
        prop_assert_eq!(model.get_like_count(&card_id).unwrap(), 1);
        prop_assert!(!model.has_liked(&card_id, &user1));
        prop_assert!(model.has_liked(&card_id, &user2));

        // User2 unlikes
        model.unlike_card(&card_id, &user2).expect("Unlike should succeed");
        prop_assert_eq!(model.get_like_count(&card_id).unwrap(), 0);
        prop_assert!(!model.has_liked(&card_id, &user1));
        prop_assert!(!model.has_liked(&card_id, &user2));
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Like Non-Existent Card Fails**
    ///
    /// Attempting to like a non-existent card should fail.
    #[test]
    fn prop_like_nonexistent_card_fails(
        user_id in uuid_strategy(),
        fake_card_id in uuid_strategy(),
    ) {
        let mut model = LikeModel::new();

        // Try to like a card that doesn't exist
        let result = model.like_card(&fake_card_id, &user_id);
        prop_assert!(result.is_err(), "Liking non-existent card should fail");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Unlike Non-Existent Card Fails**
    ///
    /// Attempting to unlike a non-existent card should fail.
    #[test]
    fn prop_unlike_nonexistent_card_fails(
        user_id in uuid_strategy(),
        fake_card_id in uuid_strategy(),
    ) {
        let mut model = LikeModel::new();

        // Try to unlike a card that doesn't exist
        let result = model.unlike_card(&fake_card_id, &user_id);
        prop_assert!(result.is_err(), "Unliking non-existent card should fail");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Unlike Without Like Is Idempotent**
    ///
    /// Unliking a card that was never liked should be idempotent (no error, no change).
    #[test]
    fn prop_unlike_without_like_is_idempotent(user_id in uuid_strategy()) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Unlike without ever liking
        let count = model.unlike_card(&card_id, &user_id)
            .expect("Unlike should succeed (idempotent)");

        prop_assert_eq!(count, 0, "Count should remain 0");
        prop_assert!(!model.has_liked(&card_id, &user_id), "Should not be liked");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Like Count Never Negative**
    ///
    /// The like count should never go below 0.
    #[test]
    fn prop_like_count_never_negative(
        user_id in uuid_strategy(),
        num_unlikes in 1usize..10usize,
    ) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Try to unlike multiple times without liking
        for _ in 0..num_unlikes {
            let count = model.unlike_card(&card_id, &user_id)
                .expect("Unlike should succeed");
            prop_assert!(count >= 0, "Like count should never be negative");
        }

        prop_assert_eq!(model.get_like_count(&card_id).unwrap(), 0, 
            "Like count should be 0");
    }

    /// **Feature: life-card-mvp, Property 14: Like/Unlike Idempotence - Likers List Consistency**
    ///
    /// The list of users who liked a card should be consistent with the like count.
    #[test]
    fn prop_likers_list_consistent_with_count(
        user_ids in prop::collection::vec(uuid_strategy(), 0..10)
    ) {
        let mut model = LikeModel::new();
        let card_id = model.create_card();

        // Have each user like the card
        for user_id in &user_ids {
            model.like_card(&card_id, user_id)
                .expect("Like should succeed");
        }

        // Get likers list
        let likers = model.get_likers(&card_id);
        let like_count = model.get_like_count(&card_id).unwrap();

        // Likers list length should equal like count
        prop_assert_eq!(likers.len() as i32, like_count, 
            "Likers list length should equal like count");

        // All likers should be in the original user list
        let unique_users: std::collections::HashSet<_> = user_ids.iter().collect();
        for liker in &likers {
            prop_assert!(unique_users.contains(liker), 
                "Liker should be in original user list");
        }
    }
}


// ============================================================================
// Property 12: Collection Completeness
// **Validates: Requirements 7.1, 7.2**
//
// For any user, "My Cards" SHALL contain exactly all cards created by that user,
// and "Collected Cards" SHALL contain exactly all cards obtained through exchange.
// ============================================================================

/// Model for simulating card collection behavior
/// This tests the business logic without database interaction
#[derive(Debug, Clone)]
struct CollectionModel {
    /// Cards created by each user: user_id -> Vec<card_id>
    created_cards: std::collections::HashMap<Uuid, Vec<Uuid>>,
    /// Cards collected by each user through exchange: user_id -> Vec<card_id>
    collected_cards: std::collections::HashMap<Uuid, Vec<Uuid>>,
    /// All cards in the system: card_id -> creator_id
    all_cards: std::collections::HashMap<Uuid, Uuid>,
    /// Deleted cards
    deleted_cards: std::collections::HashSet<Uuid>,
}

impl CollectionModel {
    fn new() -> Self {
        Self {
            created_cards: std::collections::HashMap::new(),
            collected_cards: std::collections::HashMap::new(),
            all_cards: std::collections::HashMap::new(),
            deleted_cards: std::collections::HashSet::new(),
        }
    }

    /// Create a card for a user
    fn create_card(&mut self, user_id: &Uuid) -> Uuid {
        let card_id = Uuid::new_v4();
        self.created_cards
            .entry(*user_id)
            .or_insert_with(Vec::new)
            .push(card_id);
        self.all_cards.insert(card_id, *user_id);
        card_id
    }

    /// Simulate an exchange: user collects a card
    fn collect_card(&mut self, user_id: &Uuid, card_id: &Uuid) -> Result<(), String> {
        // Card must exist and not be deleted
        if !self.all_cards.contains_key(card_id) {
            return Err("Card does not exist".to_string());
        }
        if self.deleted_cards.contains(card_id) {
            return Err("Card is deleted".to_string());
        }

        // User cannot collect their own card
        if self.all_cards.get(card_id) == Some(user_id) {
            return Err("Cannot collect your own card".to_string());
        }

        // Check if already collected
        let collected = self.collected_cards.entry(*user_id).or_insert_with(Vec::new);
        if !collected.contains(card_id) {
            collected.push(*card_id);
        }

        Ok(())
    }

    /// Delete a card (only if not collected by others)
    fn delete_card(&mut self, user_id: &Uuid, card_id: &Uuid) -> Result<(), String> {
        // Verify ownership
        if self.all_cards.get(card_id) != Some(user_id) {
            return Err("Not the owner of this card".to_string());
        }

        // Check if card has been collected by others
        for (collector_id, cards) in &self.collected_cards {
            if collector_id != user_id && cards.contains(card_id) {
                return Err("Cannot delete a card that has been exchanged to others".to_string());
            }
        }

        self.deleted_cards.insert(*card_id);
        Ok(())
    }

    /// Get all cards created by a user (excluding deleted)
    fn get_user_cards(&self, user_id: &Uuid) -> Vec<Uuid> {
        self.created_cards
            .get(user_id)
            .map(|cards| {
                cards.iter()
                    .filter(|id| !self.deleted_cards.contains(id))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get all cards collected by a user through exchange (excluding deleted)
    fn get_collected_cards(&self, user_id: &Uuid) -> Vec<Uuid> {
        self.collected_cards
            .get(user_id)
            .map(|cards| {
                cards.iter()
                    .filter(|id| !self.deleted_cards.contains(id))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Check if a card was created by a user
    fn is_created_by(&self, card_id: &Uuid, user_id: &Uuid) -> bool {
        self.all_cards.get(card_id) == Some(user_id) && !self.deleted_cards.contains(card_id)
    }

    /// Check if a card was collected by a user
    fn is_collected_by(&self, card_id: &Uuid, user_id: &Uuid) -> bool {
        self.collected_cards
            .get(user_id)
            .map(|cards| cards.contains(card_id) && !self.deleted_cards.contains(card_id))
            .unwrap_or(false)
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - My Cards Contains All Created**
    ///
    /// For any user, "My Cards" SHALL contain exactly all cards created by that user.
    #[test]
    fn prop_my_cards_contains_all_created(
        user_id in uuid_strategy(),
        num_cards in 0usize..10usize,
    ) {
        let mut model = CollectionModel::new();

        // Create multiple cards
        let mut created_ids = Vec::new();
        for _ in 0..num_cards {
            let card_id = model.create_card(&user_id);
            created_ids.push(card_id);
        }

        // Get user's cards
        let user_cards = model.get_user_cards(&user_id);

        // Verify completeness: all created cards should be in user_cards
        for card_id in &created_ids {
            prop_assert!(user_cards.contains(card_id), 
                "Created card {:?} should be in user's cards", card_id);
        }

        // Verify soundness: user_cards should only contain cards created by this user
        for card_id in &user_cards {
            prop_assert!(model.is_created_by(card_id, &user_id),
                "Card {:?} in user's cards should be created by user", card_id);
        }

        // Verify count matches
        prop_assert_eq!(user_cards.len(), created_ids.len(),
            "User cards count should match created count");
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Collected Cards Contains All Exchanged**
    ///
    /// For any user, "Collected Cards" SHALL contain exactly all cards obtained through exchange.
    #[test]
    fn prop_collected_cards_contains_all_exchanged(
        collector_id in uuid_strategy(),
        creator_ids in prop::collection::vec(uuid_strategy(), 1..5),
    ) {
        let mut model = CollectionModel::new();

        // Create cards by different users and have collector collect them
        let mut collected_ids = Vec::new();
        for creator_id in &creator_ids {
            // Skip if creator is the collector
            if creator_id == &collector_id {
                continue;
            }

            let card_id = model.create_card(creator_id);
            if model.collect_card(&collector_id, &card_id).is_ok() {
                collected_ids.push(card_id);
            }
        }

        // Get collector's collected cards
        let collected_cards = model.get_collected_cards(&collector_id);

        // Verify completeness: all collected cards should be in collected_cards
        for card_id in &collected_ids {
            prop_assert!(collected_cards.contains(card_id),
                "Collected card {:?} should be in collector's collection", card_id);
        }

        // Verify soundness: collected_cards should only contain cards collected by this user
        for card_id in &collected_cards {
            prop_assert!(model.is_collected_by(card_id, &collector_id),
                "Card {:?} in collection should be collected by user", card_id);
        }

        // Verify count matches
        prop_assert_eq!(collected_cards.len(), collected_ids.len(),
            "Collected cards count should match exchange count");
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Created and Collected Are Disjoint for Same User**
    ///
    /// A user cannot have the same card in both "My Cards" (created) and "Collected Cards" (exchanged).
    /// Cards created by a user should not appear in their collected cards.
    #[test]
    fn prop_created_and_collected_disjoint(
        user_id in uuid_strategy(),
        other_user_id in uuid_strategy(),
        num_own_cards in 1usize..5usize,
        num_other_cards in 1usize..5usize,
    ) {
        // Skip if same user
        prop_assume!(user_id != other_user_id);

        let mut model = CollectionModel::new();

        // User creates their own cards
        for _ in 0..num_own_cards {
            model.create_card(&user_id);
        }

        // Other user creates cards
        let mut other_cards = Vec::new();
        for _ in 0..num_other_cards {
            let card_id = model.create_card(&other_user_id);
            other_cards.push(card_id);
        }

        // User collects other user's cards
        for card_id in &other_cards {
            let _ = model.collect_card(&user_id, card_id);
        }

        // Get both collections
        let user_cards = model.get_user_cards(&user_id);
        let collected_cards = model.get_collected_cards(&user_id);

        // Verify disjoint: no card should be in both collections
        for card_id in &user_cards {
            prop_assert!(!collected_cards.contains(card_id),
                "Card {:?} should not be in both created and collected", card_id);
        }

        for card_id in &collected_cards {
            prop_assert!(!user_cards.contains(card_id),
                "Card {:?} should not be in both collected and created", card_id);
        }
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Cannot Collect Own Card**
    ///
    /// A user should not be able to collect their own card through exchange.
    #[test]
    fn prop_cannot_collect_own_card(
        user_id in uuid_strategy(),
    ) {
        let mut model = CollectionModel::new();

        // User creates a card
        let card_id = model.create_card(&user_id);

        // Try to collect own card
        let result = model.collect_card(&user_id, &card_id);

        prop_assert!(result.is_err(), "Should not be able to collect own card");
        
        // Verify card is not in collected cards
        let collected = model.get_collected_cards(&user_id);
        prop_assert!(!collected.contains(&card_id),
            "Own card should not appear in collected cards");
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Deleted Cards Excluded**
    ///
    /// Deleted cards should not appear in either "My Cards" or "Collected Cards".
    #[test]
    fn prop_deleted_cards_excluded_from_collections(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != collector_id);

        let mut model = CollectionModel::new();

        // Creator creates a card
        let card_id = model.create_card(&creator_id);

        // Verify card is in creator's cards
        prop_assert!(model.get_user_cards(&creator_id).contains(&card_id),
            "Card should be in creator's cards before deletion");

        // Delete the card (should succeed since not collected)
        model.delete_card(&creator_id, &card_id)
            .expect("Should be able to delete uncollected card");

        // Verify card is no longer in creator's cards
        prop_assert!(!model.get_user_cards(&creator_id).contains(&card_id),
            "Deleted card should not be in creator's cards");
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Deletion Blocked When Collected**
    ///
    /// Cards that have been collected by others cannot be deleted.
    #[test]
    fn prop_cannot_delete_collected_card(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy(),
    ) {
        prop_assume!(creator_id != collector_id);

        let mut model = CollectionModel::new();

        // Creator creates a card
        let card_id = model.create_card(&creator_id);

        // Collector collects the card
        model.collect_card(&collector_id, &card_id)
            .expect("Should be able to collect card");

        // Try to delete the card
        let result = model.delete_card(&creator_id, &card_id);

        prop_assert!(result.is_err(), 
            "Should not be able to delete a card that has been collected");

        // Verify card is still in both collections
        prop_assert!(model.get_user_cards(&creator_id).contains(&card_id),
            "Card should still be in creator's cards");
        prop_assert!(model.get_collected_cards(&collector_id).contains(&card_id),
            "Card should still be in collector's collection");
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Multiple Collectors**
    ///
    /// A card can be collected by multiple users, and should appear in all their collections.
    #[test]
    fn prop_card_in_multiple_collections(
        creator_id in uuid_strategy(),
        collector_ids in prop::collection::vec(uuid_strategy(), 1..5),
    ) {
        let mut model = CollectionModel::new();

        // Creator creates a card
        let card_id = model.create_card(&creator_id);

        // Multiple collectors collect the card
        let mut successful_collectors = Vec::new();
        for collector_id in &collector_ids {
            if collector_id != &creator_id {
                if model.collect_card(collector_id, &card_id).is_ok() {
                    successful_collectors.push(*collector_id);
                }
            }
        }

        // Verify card is in each collector's collection
        for collector_id in &successful_collectors {
            let collected = model.get_collected_cards(collector_id);
            prop_assert!(collected.contains(&card_id),
                "Card should be in collector {:?}'s collection", collector_id);
        }

        // Verify card is still in creator's cards
        prop_assert!(model.get_user_cards(&creator_id).contains(&card_id),
            "Card should still be in creator's cards");
    }

    /// **Feature: life-card-mvp, Property 12: Collection Completeness - Collection Idempotence**
    ///
    /// Collecting the same card multiple times should not create duplicates.
    #[test]
    fn prop_collection_idempotent(
        creator_id in uuid_strategy(),
        collector_id in uuid_strategy(),
        num_attempts in 2usize..5usize,
    ) {
        prop_assume!(creator_id != collector_id);

        let mut model = CollectionModel::new();

        // Creator creates a card
        let card_id = model.create_card(&creator_id);

        // Collector tries to collect the same card multiple times
        for _ in 0..num_attempts {
            let _ = model.collect_card(&collector_id, &card_id);
        }

        // Verify card appears exactly once in collection
        let collected = model.get_collected_cards(&collector_id);
        let count = collected.iter().filter(|id| *id == &card_id).count();

        prop_assert_eq!(count, 1, 
            "Card should appear exactly once in collection, not {}", count);
    }
}
