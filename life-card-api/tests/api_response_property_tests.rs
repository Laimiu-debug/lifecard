//! Property-based tests for API response consistency
//!
//! **Property 17: API Response Consistency**
//! For any API endpoint, THE System SHALL return responses with consistent structure
//! including appropriate HTTP status codes, error messages for failures, and
//! pagination metadata for list endpoints.
//!
//! **Validates: Requirements 10.1-10.8**

use proptest::prelude::*;
use serde_json::Value;

use life_card_api::models::common::{ApiResponse, Pagination, PaginatedResponse, PaginationMeta};
use life_card_api::models::card::{LifeCard, CardType, PrivacyLevel};
use life_card_api::models::user::UserSummary;
use life_card_api::error::{AppError, ErrorResponse};

use uuid::Uuid;
use chrono::{DateTime, Utc, TimeZone};

// ============================================================================
// Generators for test data
// ============================================================================

/// Generate a random UUID
fn uuid_strategy() -> impl Strategy<Value = Uuid> {
    any::<[u8; 16]>().prop_map(|bytes| Uuid::from_bytes(bytes))
}

/// Generate a valid DateTime<Utc>
fn datetime_strategy() -> impl Strategy<Value = DateTime<Utc>> {
    (1577836800i64..1893456000i64).prop_map(|ts| Utc.timestamp_opt(ts, 0).unwrap())
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

/// Generate a valid title
fn valid_title_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s]{1,50}".prop_filter("title must not be empty", |s| !s.trim().is_empty())
}

/// Generate a valid description
fn valid_description_strategy() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-\\s\\.]{1,100}".prop_filter("desc must not be empty", |s| !s.trim().is_empty())
}

/// Generate a valid UserSummary
fn user_summary_strategy() -> impl Strategy<Value = UserSummary> {
    (
        uuid_strategy(),
        prop::option::of("[a-zA-Z0-9_]{1,20}".prop_map(String::from)),
        prop::option::of("[a-z]{3,10}".prop_map(|s| format!("https://example.com/{}.jpg", s))),
        1i32..100i32,
    )
        .prop_map(|(id, nickname, avatar, level)| UserSummary {
            id,
            nickname,
            avatar,
            level,
        })
}

/// Generate a valid LifeCard for testing - split into smaller tuples
fn life_card_strategy() -> impl Strategy<Value = LifeCard> {
    let basic = (
        uuid_strategy(),
        uuid_strategy(),
        card_type_strategy(),
        valid_title_strategy(),
        valid_description_strategy(),
    );
    
    let metadata = (
        privacy_level_strategy(),
        1i32..1000i32,
        0i32..10000i32,
        0i32..10000i32,
        0i32..10000i32,
    );
    
    let flags = (
        any::<bool>(),
        any::<bool>(),
        datetime_strategy(),
        datetime_strategy(),
    );

    (basic, metadata, flags).prop_map(|(
        (id, creator_id, card_type, title, description),
        (privacy_level, exchange_price, like_count, comment_count, exchange_count),
        (is_liked, is_collected, created_at, updated_at),
    )| {
        LifeCard {
            id,
            creator_id,
            creator: None,
            card_type,
            title,
            description,
            media: vec![],
            location: None,
            emotion_tags: vec![],
            interest_tags: vec![],
            privacy_level,
            exchange_price,
            like_count,
            comment_count,
            exchange_count,
            is_liked,
            is_collected,
            created_at,
            updated_at,
        }
    })
}

/// Generate a vector of LifeCards
fn life_cards_strategy() -> impl Strategy<Value = Vec<LifeCard>> {
    prop::collection::vec(life_card_strategy(), 0..10)
}

/// Generate valid pagination parameters
fn pagination_strategy() -> impl Strategy<Value = Pagination> {
    (1i32..100i32, 1i32..50i32).prop_map(|(page, page_size)| Pagination::new(page, page_size))
}

// ============================================================================
// Property 17: API Response Consistency Tests
// **Validates: Requirements 10.1-10.8**
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]

    /// **Property 17.1: Success Response Structure**
    /// Requirement 10.1: WHEN an API request succeeds, THE System SHALL return
    /// success response with requested data.
    /// Requirement 10.7: THE System SHALL include consistent response structure.
    #[test]
    fn prop_success_response_has_consistent_structure(card in life_card_strategy()) {
        // Create a success response
        let response = ApiResponse::success(card.clone());
        
        // Serialize to JSON
        let json = serde_json::to_string(&response)
            .expect("ApiResponse should serialize to JSON");
        
        // Parse as generic JSON to verify structure
        let parsed: Value = serde_json::from_str(&json)
            .expect("Should parse as JSON");
        
        // Verify required fields exist
        prop_assert!(parsed.get("success").is_some(), "Response should have 'success' field");
        prop_assert!(parsed.get("data").is_some(), "Success response should have 'data' field");
        
        // Verify success is true
        prop_assert_eq!(parsed["success"].as_bool(), Some(true), "Success should be true");
        
        // Verify data contains the card
        let data = &parsed["data"];
        prop_assert!(data.get("id").is_some(), "Data should contain card id");
        prop_assert!(data.get("title").is_some(), "Data should contain card title");
    }

    /// **Property 17.2: Success Response Round-Trip**
    /// Requirement 10.1, 10.7: Success responses should serialize and deserialize correctly.
    #[test]
    fn prop_success_response_round_trip(card in life_card_strategy()) {
        let response = ApiResponse::success(card.clone());
        
        // Serialize
        let json = serde_json::to_string(&response)
            .expect("Should serialize");
        
        // Deserialize
        let recovered: ApiResponse<LifeCard> = serde_json::from_str(&json)
            .expect("Should deserialize");
        
        // Verify structure
        prop_assert!(recovered.success, "Recovered response should be success");
        prop_assert!(recovered.data.is_some(), "Recovered response should have data");
        
        let recovered_card = recovered.data.unwrap();
        prop_assert_eq!(recovered_card.id, card.id, "Card ID should match");
        prop_assert_eq!(recovered_card.title, card.title, "Card title should match");
    }

    /// **Property 17.3: Paginated Response Structure**
    /// Requirement 10.8: THE System SHALL include pagination metadata for list endpoints.
    #[test]
    fn prop_paginated_response_has_metadata(
        cards in life_cards_strategy(),
        pagination in pagination_strategy(),
        total_count in 0i64..1000i64,
    ) {
        // Create pagination metadata
        let meta = PaginationMeta::new(pagination.page, pagination.page_size, total_count);
        
        // Create a paginated response
        let response = PaginatedResponse {
            data: cards.clone(),
            pagination: meta,
        };
        
        // Serialize to JSON
        let json = serde_json::to_string(&response)
            .expect("PaginatedResponse should serialize to JSON");
        
        // Parse as generic JSON
        let parsed: Value = serde_json::from_str(&json)
            .expect("Should parse as JSON");
        
        // Verify pagination metadata fields exist
        prop_assert!(parsed.get("data").is_some(), "Should have 'data' field");
        prop_assert!(parsed.get("pagination").is_some(), "Should have 'pagination' field");
        
        let pagination_meta = &parsed["pagination"];
        prop_assert!(pagination_meta.get("page").is_some(), "Should have 'page' field");
        prop_assert!(pagination_meta.get("page_size").is_some(), "Should have 'page_size' field");
        prop_assert!(pagination_meta.get("total_count").is_some(), "Should have 'total_count' field");
        prop_assert!(pagination_meta.get("total_pages").is_some(), "Should have 'total_pages' field");
        
        // Verify data count matches
        let data = parsed["data"].as_array();
        prop_assert!(data.is_some(), "Data should be an array");
        prop_assert_eq!(data.unwrap().len(), cards.len(), "Data count should match");
    }

    /// **Property 17.4: Pagination Metadata Correctness**
    /// Requirement 10.8: Pagination metadata should be mathematically correct.
    #[test]
    fn prop_pagination_metadata_is_correct(
        page in 1i32..50i32,
        page_size in 1i32..50i32,
        total_count in 0i64..1000i64,
    ) {
        let meta = PaginationMeta::new(page, page_size, total_count);
        
        // Verify total_pages calculation
        let expected_total_pages = if total_count == 0 {
            0
        } else {
            ((total_count as f64) / (page_size as f64)).ceil() as i32
        };
        prop_assert_eq!(meta.total_pages, expected_total_pages, 
            "Total pages should be ceil(total_count / page_size)");
        
        // Verify page and page_size are preserved
        prop_assert_eq!(meta.page, page, "Page should be preserved");
        prop_assert_eq!(meta.page_size, page_size, "Page size should be preserved");
        prop_assert_eq!(meta.total_count, total_count, "Total count should be preserved");
    }

    /// **Property 17.5: ApiResponse with Message**
    /// Requirement 10.7: Responses can include optional messages.
    #[test]
    fn prop_ok_with_message_has_correct_structure(
        message in "[a-zA-Z0-9_\\-\\s\\.]{1,100}".prop_filter("msg must not be empty", |s| !s.trim().is_empty())
    ) {
        let response = ApiResponse::<()>::ok_with_message(&message);
        
        // Serialize to JSON
        let json = serde_json::to_string(&response)
            .expect("Should serialize");
        
        // Parse as generic JSON
        let parsed: Value = serde_json::from_str(&json)
            .expect("Should parse as JSON");
        
        // Verify structure
        prop_assert_eq!(parsed["success"].as_bool(), Some(true), "Should be success");
        prop_assert!(parsed.get("message").is_some(), "Should have message field");
        prop_assert_eq!(parsed["message"].as_str(), Some(message.as_str()), "Message should match");
    }
}

// ============================================================================
// Additional API Response Consistency Tests
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(50))]

    /// **Property 17.6: Empty List Response**
    /// Requirement 10.8: Empty lists should still have proper pagination metadata.
    #[test]
    fn prop_empty_list_has_pagination_metadata(
        pagination in pagination_strategy(),
    ) {
        let empty_cards: Vec<LifeCard> = vec![];
        let meta = PaginationMeta::new(pagination.page, pagination.page_size, 0);
        let response = PaginatedResponse {
            data: empty_cards,
            pagination: meta,
        };
        
        // Verify metadata for empty list
        prop_assert_eq!(response.pagination.total_count, 0, "Total count should be 0");
        prop_assert_eq!(response.pagination.total_pages, 0, "Total pages should be 0 for empty list");
        prop_assert!(response.data.is_empty(), "Data should be empty");
    }

    /// **Property 17.7: Response Type Consistency**
    /// Requirement 10.7: Different data types should serialize with same wrapper structure.
    #[test]
    fn prop_different_types_have_same_wrapper_structure(
        card in life_card_strategy(),
        user in user_summary_strategy(),
    ) {
        // Create responses with different data types
        let card_response = ApiResponse::success(card);
        let user_response = ApiResponse::success(user);
        
        // Serialize both
        let card_json: Value = serde_json::from_str(
            &serde_json::to_string(&card_response).unwrap()
        ).unwrap();
        let user_json: Value = serde_json::from_str(
            &serde_json::to_string(&user_response).unwrap()
        ).unwrap();
        
        // Both should have same top-level structure
        prop_assert!(card_json.get("success").is_some(), "Card response should have success");
        prop_assert!(user_json.get("success").is_some(), "User response should have success");
        prop_assert!(card_json.get("data").is_some(), "Card response should have data");
        prop_assert!(user_json.get("data").is_some(), "User response should have data");
        
        // Both success fields should be true
        prop_assert_eq!(card_json["success"].as_bool(), Some(true));
        prop_assert_eq!(user_json["success"].as_bool(), Some(true));
    }

    /// **Property 17.8: Pagination Offset Calculation**
    /// Requirement 10.8: Pagination offset should be correctly calculated.
    #[test]
    fn prop_pagination_offset_is_correct(
        page in 1i32..100i32,
        page_size in 1i32..50i32,
    ) {
        let pagination = Pagination::new(page, page_size);
        
        let expected_offset = ((page - 1) * page_size) as i64;
        prop_assert_eq!(pagination.offset(), expected_offset, 
            "Offset should be (page - 1) * page_size");
        
        let expected_limit = page_size as i64;
        prop_assert_eq!(pagination.limit(), expected_limit, 
            "Limit should equal page_size");
    }

    /// **Property 17.9: Pagination Bounds**
    /// Requirement 10.8: Pagination should handle edge cases correctly.
    #[test]
    fn prop_pagination_handles_bounds(
        page in -10i32..200i32,
        page_size in -10i32..200i32,
    ) {
        let pagination = Pagination::new(page, page_size);
        
        // Page should be at least 1
        prop_assert!(pagination.page >= 1, "Page should be at least 1");
        
        // Page size should be at least 1 and at most 100
        prop_assert!(pagination.page_size >= 1, "Page size should be at least 1");
        prop_assert!(pagination.page_size <= 100, "Page size should be at most 100");
        
        // Offset should never be negative
        prop_assert!(pagination.offset() >= 0, "Offset should never be negative");
    }
}

// ============================================================================
// Error Response Consistency Tests
// ============================================================================

#[cfg(test)]
mod error_tests {
    use super::*;
    use axum::response::IntoResponse;

    /// Test that AppError variants produce valid error responses
    /// Requirements 10.2-10.6
    #[test]
    fn test_app_error_produces_valid_response() {
        let errors = vec![
            AppError::Validation("Invalid input".to_string()),
            AppError::Unauthorized,
            AppError::Forbidden,
            AppError::NotFound("Resource not found".to_string()),
            AppError::BusinessLogic("Business error".to_string()),
        ];

        for error in errors {
            // Convert to response
            let response = error.into_response();
            
            // Verify response has a status code
            let status = response.status();
            assert!(status.is_client_error() || status.is_server_error(), 
                "Error response should have error status code");
        }
    }

    /// Test that ErrorResponse has consistent JSON structure
    #[test]
    fn test_error_response_json_structure() {
        let error_response = ErrorResponse {
            success: false,
            error: life_card_api::error::ErrorDetail {
                code: "TEST_ERROR".to_string(),
                message: "Test error message".to_string(),
                details: None,
            },
            timestamp: Utc::now(),
            request_id: Uuid::new_v4().to_string(),
        };

        let json = serde_json::to_string(&error_response).unwrap();
        let parsed: Value = serde_json::from_str(&json).unwrap();

        // Verify required fields
        assert!(parsed.get("success").is_some(), "Should have success field");
        assert_eq!(parsed["success"].as_bool(), Some(false), "Success should be false");
        assert!(parsed.get("error").is_some(), "Should have error field");
        assert!(parsed.get("timestamp").is_some(), "Should have timestamp field");
        assert!(parsed.get("request_id").is_some(), "Should have request_id field");

        // Verify error detail structure
        let error = &parsed["error"];
        assert!(error.get("code").is_some(), "Error should have code");
        assert!(error.get("message").is_some(), "Error should have message");
    }

    /// Test that error response round-trips correctly
    #[test]
    fn test_error_response_round_trip() {
        let original = ErrorResponse {
            success: false,
            error: life_card_api::error::ErrorDetail {
                code: "VALIDATION_ERROR".to_string(),
                message: "Field is required".to_string(),
                details: None,
            },
            timestamp: Utc::now(),
            request_id: Uuid::new_v4().to_string(),
        };

        let json = serde_json::to_string(&original).unwrap();
        let recovered: ErrorResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(recovered.success, original.success);
        assert_eq!(recovered.error.code, original.error.code);
        assert_eq!(recovered.error.message, original.error.message);
        assert_eq!(recovered.request_id, original.request_id);
    }
}
