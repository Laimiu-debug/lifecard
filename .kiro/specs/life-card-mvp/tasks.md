# Implementation Plan: Life Card MVP

## Overview

本实现计划将人生卡片App MVP后端分解为可执行的编码任务。采用Rust + Axum + PostgreSQL技术栈，按照模块化方式逐步构建用户系统、卡片系统、交换系统和推荐引擎。

## Tasks

- [x] 1. Project Setup and Core Infrastructure
  - [x] 1.1 Initialize Rust project with Cargo
    - Create `Cargo.toml` with all dependencies (axum, tokio, sqlx, serde, etc.)
    - Set up workspace structure
    - Create `.env.example` with configuration template
    - _Requirements: 10.1-10.8_

  - [x] 1.2 Set up database schema and migrations
    - Create `migrations/001_initial_schema.sql` with all tables
    - Implement custom PostgreSQL types (card_type, privacy_level, exchange_status)
    - Add indexes and triggers
    - _Requirements: 9.1, 9.5_

  - [x] 1.3 Implement core configuration and error handling
    - Create `src/config.rs` for environment configuration
    - Create `src/error.rs` with AppError enum and IntoResponse implementation
    - Set up structured logging with tracing
    - _Requirements: 10.1-10.8_

  - [x] 1.4 Set up database connection pool
    - Create `src/db/postgres.rs` with SQLx connection pool
    - Implement health check endpoint
    - _Requirements: 9.1, 9.5_

- [x] 2. Checkpoint - Verify project compiles and database connects
  - Ensure `cargo build` succeeds
  - Verify database migration runs successfully
  - Ask the user if questions arise

- [x] 3. User Module - Models and Authentication
  - [x] 3.1 Implement user models
    - Create `src/models/user.rs` with User, UserProfile, UserSummary structs
    - Implement Serialize/Deserialize with serde
    - Add SQLx FromRow derives
    - _Requirements: 2.1, 2.6, 2.7_

  - [x] 3.2 Implement password hashing utilities
    - Create `src/utils/password.rs` with argon2 hashing
    - Implement hash and verify functions
    - _Requirements: 1.1, 1.4_

  - [x] 3.3 Implement JWT utilities
    - Create `src/utils/jwt.rs` with token generation and validation
    - Configure token expiration
    - _Requirements: 1.1, 1.4_

  - [x] 3.4 Implement user service - registration and login
    - Create `src/services/user_service.rs`
    - Implement `register` function with email validation and password hashing
    - Implement `login` function with credential verification
    - Initialize new users with default coin balance (100)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 3.5 Write property test for user registration round-trip
    - **Property 1: User Registration Round-Trip**
    - **Validates: Requirements 1.1, 1.4**

  - [x] 3.6 Write property test for input validation rejection
    - **Property 2: Input Validation Rejection**
    - **Validates: Requirements 1.2, 1.5, 3.8**

  - [x] 3.7 Write property test for new user initialization
    - **Property 3: New User Initialization Invariant**
    - **Validates: Requirements 1.7**

- [x] 4. User Module - Profile and Social
  - [x] 4.1 Implement profile management
    - Add `get_profile`, `update_profile` functions to user service
    - Implement interest tags management
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 4.2 Write property test for profile update round-trip
    - **Property 4: Profile Update Round-Trip**
    - **Validates: Requirements 2.1, 2.3**

  - [x] 4.3 Implement follow/unfollow functionality
    - Add `follow_user`, `unfollow_user` functions
    - Implement follower/following count tracking
    - Add `get_followers`, `get_following` with pagination
    - _Requirements: 8.5, 8.6, 8.7_

  - [x] 4.4 Write property test for follow relationship consistency
    - **Property 15: Follow Relationship Consistency**
    - **Validates: Requirements 8.5, 8.6, 8.7**

- [x] 5. User Module - Experience Coins
  - [x] 5.1 Implement coin transaction system
    - Add `add_coins`, `deduct_coins` functions with transaction logging
    - Implement balance validation (prevent negative balance)
    - Add `get_coin_balance`, `get_coin_history` functions
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.2 Write property test for coin balance invariant
    - **Property 11: Coin Balance Invariant**
    - **Validates: Requirements 6.4, 6.6**

- [x] 6. Checkpoint - User module complete
  - Ensure all user service functions work correctly
  - Run all user-related tests
  - Ask the user if questions arise

- [x] 7. Card Module - Models and CRUD
  - [x] 7.1 Implement card models
    - Create `src/models/card.rs` with LifeCard, CardType, PrivacyLevel, MediaItem, Location
    - Implement Serialize/Deserialize with proper enum handling
    - Add SQLx type mappings for PostgreSQL enums
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Write property test for card serialization round-trip
    - **Property 16: Card Serialization Round-Trip**
    - **Validates: Requirements 9.4**

  - [x] 7.3 Implement card service - create and read
    - Create `src/services/card_service.rs`
    - Implement `create_card` with validation and coin awarding
    - Implement `get_card` with privacy enforcement
    - _Requirements: 3.2, 3.7, 3.8, 3.9, 3.10, 4.6, 4.7_

  - [x] 7.4 Write property test for card creation round-trip
    - **Property 5: Card Creation Round-Trip**
    - **Validates: Requirements 3.2, 3.9, 3.10**

  - [x] 7.5 Implement card service - update and delete
    - Implement `update_card` with ownership validation
    - Implement `delete_card` with exchange constraint check
    - _Requirements: 7.5, 7.6, 9.2_

  - [x] 7.6 Write property test for card deletion constraints
    - **Property 13: Card Deletion Constraints**
    - **Validates: Requirements 7.5, 7.6**

- [x] 8. Card Module - Tags and Privacy
  - [x] 8.1 Implement tag association
    - Add emotion_tags and interest_tags handling in card creation/update
    - Implement tag-based filtering
    - _Requirements: 3.5, 3.6_

  - [x] 8.2 Write property test for tag association completeness
    - **Property 6: Tag Association Completeness**
    - **Validates: Requirements 3.5, 3.6**

  - [x] 8.3 Implement privacy enforcement
    - Add privacy level checking in card retrieval
    - Implement visibility rules (public, friends_only, exchange_only)
    - _Requirements: 3.7, 4.7_

  - [x] 8.4 Write property test for privacy enforcement
    - **Property 7: Privacy Enforcement**
    - **Validates: Requirements 3.7, 4.7**

- [x] 9. Card Module - Discovery and Search
  - [x] 9.1 Implement card search
    - Add `search_cards` with keyword, type, and tag filtering
    - Implement full-text search using PostgreSQL tsvector
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 9.2 Implement location-based filtering
    - Add geographic distance calculation
    - Implement `search_cards` with location filter
    - _Requirements: 4.5_

  - [x] 9.3 Write property test for search and filter accuracy
    - **Property 8: Search and Filter Accuracy**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [x] 9.4 Implement pagination
    - Add pagination support to all list endpoints
    - Implement cursor-based pagination for feed
    - _Requirements: 4.8_

  - [x] 9.5 Write property test for pagination correctness
    - **Property 9: Pagination Correctness**
    - **Validates: Requirements 4.8**

- [x] 10. Card Module - Social Interactions
  - [x] 10.1 Implement like/unlike functionality
    - Add `like_card`, `unlike_card` functions
    - Implement like count tracking
    - _Requirements: 8.1, 8.2_

  - [x] 10.2 Write property test for like/unlike idempotence
    - **Property 14: Like/Unlike Idempotence**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 10.3 Implement comments
    - Add `add_comment`, `delete_comment`, `get_comments` functions
    - Implement comment count tracking
    - _Requirements: 8.3, 8.4_

- [x] 11. Card Module - Collection Management
  - [x] 11.1 Implement user card collections
    - Add `get_user_cards` for cards created by user
    - Add `get_collected_cards` for cards obtained through exchange
    - _Requirements: 7.1, 7.2_

  - [x] 11.2 Write property test for collection completeness
    - **Property 12: Collection Completeness**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 11.3 Implement folder management
    - Add `create_folder`, `get_folders`, `move_to_folder` functions
    - _Requirements: 7.3, 7.4, 7.7, 7.8_

- [x] 12. Checkpoint - Card module complete
  - Ensure all card service functions work correctly
  - Run all card-related tests
  - Ask the user if questions arise

- [ ] 13. Exchange Module
  - [x] 13.1 Implement exchange models
    - Create `src/models/exchange.rs` with ExchangeRequest, ExchangeStatus, ExchangeRecord
    - Add SQLx type mappings
    - _Requirements: 5.1-5.9_

  - [x] 13.2 Implement exchange request creation
    - Add `create_exchange_request` with coin deduction
    - Implement balance validation
    - Set expiration time (72 hours)
    - _Requirements: 5.1, 5.2_

  - [x] 13.3 Implement exchange acceptance and rejection
    - Add `accept_exchange` with coin transfer and card access grant
    - Add `reject_exchange` with coin refund
    - Add `cancel_exchange` for requester cancellation
    - _Requirements: 5.3, 5.4_

  - [x] 13.4 Implement exchange expiration
    - Add `process_expired_requests` for automatic refund
    - Set up background task for expiration processing
    - _Requirements: 5.5_

  - [x] 13.5 Write property test for exchange flow integrity
    - **Property 10: Exchange Flow Integrity**
    - **Validates: Requirements 5.1, 5.3, 5.4, 5.5**

  - [x] 13.6 Implement exchange history
    - Add `get_exchange_history`, `get_pending_requests`, `get_sent_requests`
    - _Requirements: 5.6, 5.7_

  - [x] 13.7 Implement dynamic pricing
    - Add `calculate_exchange_price` based on card popularity
    - _Requirements: 6.7_

- [x] 14. Checkpoint - Exchange module complete
  - Ensure all exchange service functions work correctly
  - Run all exchange-related tests
  - Ask the user if questions arise

- [x] 15. Recommendation Engine
  - [x] 15.1 Implement user behavior tracking
    - Create `src/services/recommendation_service.rs`
    - Add `record_view`, `record_like`, `record_exchange` functions
    - _Requirements: 4.1_

  - [x] 15.2 Implement personalized feed
    - Add `get_personalized_feed` based on user interest tags and behavior
    - Prioritize cards from followed users
    - _Requirements: 4.1, 8.8_

  - [x] 15.3 Implement hot rankings
    - Add `update_hot_rankings` with hot score calculation
    - Add `get_hot_rankings` for day/week/month
    - Implement Redis caching for rankings
    - _Requirements: 4.9_

  - [x] 15.4 Implement random discovery
    - Add `get_random_cards` for exploration mode
    - _Requirements: 4.10_

- [x] 16. API Handlers and Routing
  - [x] 16.1 Implement authentication middleware
    - Create `src/middleware/auth.rs` with JWT validation
    - Extract user ID from token
    - _Requirements: 1.4, 10.3_

  - [x] 16.2 Implement user API handlers
    - Create `src/handlers/auth.rs` with register, login endpoints
    - Create `src/handlers/user.rs` with profile, follow endpoints
    - _Requirements: 1.1-1.7, 2.1-2.7, 8.5-8.7_

  - [x] 16.3 Implement card API handlers
    - Create `src/handlers/card.rs` with CRUD, search, social endpoints
    - _Requirements: 3.1-3.10, 4.1-4.10, 7.1-7.8, 8.1-8.4_

  - [x] 16.4 Implement exchange API handlers
    - Create `src/handlers/exchange.rs` with exchange flow endpoints
    - _Requirements: 5.1-5.9, 6.1-6.7_

  - [x] 16.5 Set up main router
    - Create `src/main.rs` with Axum router configuration
    - Wire all handlers and middleware
    - Add CORS and rate limiting
    - _Requirements: 10.1-10.8_

  - [x] 16.6 Write property test for API response consistency
    - **Property 17: API Response Consistency**
    - **Validates: Requirements 10.1-10.8**

- [x] 17. Final Checkpoint - Full integration
  - Run all tests (unit and property)
  - Verify all API endpoints work correctly
  - Test end-to-end flows
  - Ask the user if questions arise

## Notes

- All tasks including property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using proptest
- Unit tests validate specific examples and edge cases
