# Requirements Document

## Introduction

人生卡片App MVP版本 - 一个创新的生命体验交换平台，让用户通过分享真实人生经历（以"卡片"形式）与他人交换体验，从而获得虚拟的多样化人生体验。这是一个让人们突破单一人生轨迹限制，体验不同人生可能性的创新应用。MVP阶段聚焦于核心的卡片创建、浏览、交换功能以及基础的用户系统和推荐算法。

## Glossary

- **Life_Card**: 人生卡片，用户创建的结构化生命体验记录，包含时间、地点、事件描述、情感状态、照片/视频、标签分类等要素
- **Card_System**: 卡片系统，负责卡片的创建、存储、检索、验证和管理
- **User_Service**: 用户服务，处理用户注册、登录、个人资料管理、经历币余额
- **Exchange_Service**: 交换服务，处理卡片交换匹配、一对一交换和交易逻辑
- **Experience_Coin**: 经历币，平台虚拟货币，通过分享卡片获得，用于兑换他人卡片
- **Card_Type**: 卡片类型，包括一天体验卡(Day_Card)、一周体验卡(Week_Card)、人生片段卡(Fragment_Card)、重要时刻卡(Moment_Card)
- **Privacy_Level**: 隐私级别，包括公开(Public)、好友可见(Friends_Only)、仅交换可见(Exchange_Only)
- **Recommendation_Engine**: 推荐引擎，基于用户兴趣标签、浏览历史的个性化推荐系统
- **Emotion_Tag**: 情感标签，描述卡片情感状态的标签（如喜悦、感动、成长等）
- **Interest_Tag**: 兴趣标签，用于用户画像和卡片分类（如旅行、职业、情感、成就等）

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a new user, I want to register and login to the platform, so that I can create and exchange life cards.

#### Acceptance Criteria

1. WHEN a user provides valid email and password, THE User_Service SHALL create a new account and return authentication token
2. WHEN a user provides invalid email format, THE User_Service SHALL reject registration and return validation error
3. WHEN a user attempts to register with existing email, THE User_Service SHALL reject registration and return duplicate error
4. WHEN a registered user provides correct credentials, THE User_Service SHALL authenticate and return session token
5. WHEN a user provides incorrect credentials, THE User_Service SHALL reject login and return authentication error
6. WHEN a user requests password reset, THE User_Service SHALL send reset link to registered email
7. THE User_Service SHALL initialize new user with default experience coin balance

### Requirement 2: User Profile Management

**User Story:** As a user, I want to manage my profile information including interest tags, so that I can personalize my experience and get better recommendations.

#### Acceptance Criteria

1. WHEN a user updates profile information (nickname, bio, age range, location), THE User_Service SHALL persist changes and return updated profile
2. WHEN a user uploads avatar image, THE User_Service SHALL validate image format and size, then store the image
3. WHEN a user sets interest tags (旅行、职业、情感、成就等), THE User_Service SHALL store tags for recommendation matching
4. THE User_Service SHALL display user's experience coin balance on profile page
5. WHEN a user views another user's profile, THE User_Service SHALL show public information based on privacy settings
6. THE User_Service SHALL track and display user's card creation count and exchange count
7. THE User_Service SHALL support user level system based on activity (创作和交换活跃度)

### Requirement 3: Life Card Creation

**User Story:** As a user, I want to create different types of life cards to record my experiences, so that I can share and exchange them with others.

#### Acceptance Criteria

1. WHEN a user creates a card, THE Card_System SHALL require card type selection (一天体验卡/一周体验卡/人生片段卡/重要时刻卡)
2. WHEN a user creates a card with title, description, and card type, THE Card_System SHALL validate required fields and create the card
3. WHEN a user attaches media (photos/videos) to a card, THE Card_System SHALL upload and associate media with the card
4. WHEN a user sets location for a card, THE Card_System SHALL store geographic coordinates and location name for authenticity verification
5. WHEN a user adds emotion tags to a card, THE Card_System SHALL associate tags with the card for categorization
6. WHEN a user adds interest category tags to a card, THE Card_System SHALL associate category tags for discovery
7. WHEN a user sets privacy level for a card (公开/好友可见/仅交换可见), THE Card_System SHALL enforce visibility rules based on the setting
8. WHEN a user attempts to create a card with empty required fields, THE Card_System SHALL reject creation and return validation error
9. THE Card_System SHALL automatically record creation timestamp for authenticity verification
10. WHEN a card is created, THE Card_System SHALL award experience coins to the creator based on card completeness

### Requirement 4: Life Card Browsing and Discovery

**User Story:** As a user, I want to browse and discover life cards through personalized recommendations and search, so that I can find interesting experiences to exchange.

#### Acceptance Criteria

1. WHEN a user opens the home feed, THE Recommendation_Engine SHALL display personalized card recommendations based on user interest tags and browsing history
2. WHEN a user searches by keyword, THE Card_System SHALL return matching cards based on title, description, and tags
3. WHEN a user filters by card type, THE Card_System SHALL return only cards of the specified type
4. WHEN a user filters by interest category (职业/旅行/情感/成就), THE Card_System SHALL return cards matching the category
5. WHEN a user filters by location, THE Card_System SHALL return cards within the specified geographic area
6. WHEN a user views card details, THE Card_System SHALL display full card content including media, creator info, and exchange price
7. THE Card_System SHALL respect privacy settings when displaying cards to users
8. WHEN a user scrolls the feed, THE Card_System SHALL load more cards using pagination
9. THE Card_System SHALL support hot ranking display (最受欢迎卡片、本周热门经历)
10. THE Card_System SHALL support random discovery mode (探索模式) for serendipitous card finding

### Requirement 5: Card Exchange Mechanism

**User Story:** As a user, I want to exchange my cards with others using experience coins, so that I can experience different life stories.

#### Acceptance Criteria

1. WHEN a user initiates exchange request with sufficient experience coins, THE Exchange_Service SHALL create pending exchange and deduct coins
2. WHEN a user has insufficient experience coins, THE Exchange_Service SHALL reject exchange request and return balance error
3. WHEN card owner accepts exchange request, THE Exchange_Service SHALL complete exchange and grant card access to requester
4. WHEN card owner rejects exchange request, THE Exchange_Service SHALL refund experience coins to requester
5. WHEN exchange request expires without response (default 72 hours), THE Exchange_Service SHALL automatically refund coins and cancel request
6. THE Exchange_Service SHALL record all exchange transactions for history tracking
7. WHEN a user views their exchange history, THE Exchange_Service SHALL display all past exchanges with status
8. THE Exchange_Service SHALL support one-to-one direct exchange between users
9. WHEN a card is exchanged, THE Exchange_Service SHALL award bonus experience coins to the card creator

### Requirement 6: Experience Coin System

**User Story:** As a user, I want to earn and spend experience coins through various activities, so that I can participate in the card exchange economy.

#### Acceptance Criteria

1. WHEN a user creates a new card, THE User_Service SHALL award experience coins based on card completeness (有媒体、有位置、有情感标签等)
2. WHEN a user's card is exchanged by others, THE User_Service SHALL award bonus experience coins to the creator
3. WHEN a user completes daily login, THE User_Service SHALL award daily login bonus coins
4. THE User_Service SHALL maintain accurate coin balance for each user
5. WHEN a user views coin history, THE User_Service SHALL display all coin transactions with timestamps and reasons
6. THE User_Service SHALL prevent negative coin balance through transaction validation
7. THE User_Service SHALL support coin cost calculation based on card popularity (热门卡片需要更多经历币)

### Requirement 7: Card Collection Management

**User Story:** As a user, I want to manage my card collection with folders, so that I can organize cards I've created and obtained through exchange.

#### Acceptance Criteria

1. WHEN a user views "My Cards" (我的卡片库), THE Card_System SHALL display all cards created by the user
2. WHEN a user views "Collected Cards" (收集的卡片), THE Card_System SHALL display all cards obtained through exchange
3. WHEN a user creates a collection folder (收藏夹), THE Card_System SHALL create named folder for organizing cards
4. WHEN a user moves a card to a folder, THE Card_System SHALL update card's folder association
5. WHEN a user deletes their own card, THE Card_System SHALL remove card and associated media
6. THE Card_System SHALL prevent deletion of cards that have been exchanged to others
7. THE Card_System SHALL support timeline view (时间轴模式) for chronological card display
8. THE Card_System SHALL support category view (主题集合) for cards grouped by interest category

### Requirement 8: Basic Social Interactions

**User Story:** As a user, I want to interact with cards and other users through likes, comments and follows, so that I can engage with the community.

#### Acceptance Criteria

1. WHEN a user likes a card (点赞), THE Card_System SHALL increment like count and record user's like
2. WHEN a user unlikes a card, THE Card_System SHALL decrement like count and remove user's like record
3. WHEN a user comments on a card (评论), THE Card_System SHALL store comment and associate with card and user
4. WHEN a user deletes their comment, THE Card_System SHALL remove the comment
5. WHEN a user follows another user (关注), THE User_Service SHALL create follow relationship
6. WHEN a user unfollows another user, THE User_Service SHALL remove follow relationship
7. THE User_Service SHALL track follower and following counts for each user
8. WHEN a user views their feed, THE Recommendation_Engine SHALL prioritize cards from followed users

### Requirement 9: Card Data Persistence and Serialization

**User Story:** As a developer, I want card data to be reliably stored, serialized and retrieved, so that users don't lose their content.

#### Acceptance Criteria

1. WHEN a card is created, THE Card_System SHALL persist card data to the database
2. WHEN a card is updated, THE Card_System SHALL update stored data and maintain update timestamp
3. WHEN card data is retrieved, THE Card_System SHALL return complete card object with all associated data
4. FOR ALL valid Life_Card objects, serializing then deserializing SHALL produce an equivalent object (round-trip property)
5. THE Card_System SHALL handle concurrent card operations without data corruption
6. THE Card_System SHALL support card data export in standard format (JSON)

### Requirement 10: API Response Handling

**User Story:** As a developer, I want consistent API responses with proper error handling, so that the frontend can reliably process data.

#### Acceptance Criteria

1. WHEN an API request succeeds, THE System SHALL return success response with requested data
2. WHEN an API request fails due to validation, THE System SHALL return 400 status with error details
3. WHEN an API request fails due to authentication, THE System SHALL return 401 status
4. WHEN an API request fails due to authorization, THE System SHALL return 403 status
5. WHEN requested resource is not found, THE System SHALL return 404 status
6. WHEN server error occurs, THE System SHALL return 500 status and log error details
7. THE System SHALL include consistent response structure across all endpoints
8. THE System SHALL include pagination metadata for list endpoints
