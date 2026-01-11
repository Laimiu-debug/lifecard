# Requirements Document

## Introduction

Life Card 微信小程序是一个人生体验卡片分享与交换平台的前端应用。用户可以创建、浏览、搜索和交换人生体验卡片，与他人分享生活中的精彩时刻。小程序将调用已有的 Rust 后端 API 实现所有功能。

## Glossary

- **Mini_Program**: 微信小程序前端应用
- **Life_Card**: 人生体验卡片，包含标题、描述、媒体、位置、标签等信息
- **Card_Type**: 卡片类型，包括一天体验卡(day_card)、一周体验卡(week_card)、人生片段卡(fragment_card)、重要时刻卡(moment_card)
- **Exchange**: 卡片交换，用户之间互换卡片的行为
- **Coin**: 虚拟货币，用于卡片交换
- **Feed**: 个性化推荐的卡片流
- **Privacy_Level**: 隐私级别，包括公开(public)、好友可见(friends_only)、仅交换可见(exchange_only)
- **User**: 小程序用户
- **API_Service**: 后端 API 服务层

## Requirements

### Requirement 1: 用户认证与登录

**User Story:** As a user, I want to log in using my WeChat account, so that I can access personalized features and my card collection.

#### Acceptance Criteria

1. WHEN the Mini_Program launches for the first time, THE Mini_Program SHALL display a login button for WeChat authorization
2. WHEN a user clicks the login button, THE Mini_Program SHALL request WeChat user profile permission
3. WHEN WeChat authorization succeeds, THE Mini_Program SHALL send the authorization code to the API_Service for authentication
4. WHEN authentication succeeds, THE Mini_Program SHALL store the JWT token securely and navigate to the home page
5. IF authentication fails, THEN THE Mini_Program SHALL display an error message and allow retry
6. WHILE a valid token exists, THE Mini_Program SHALL automatically authenticate on subsequent launches

### Requirement 2: 用户个人资料管理

**User Story:** As a user, I want to view and edit my profile, so that I can personalize my presence on the platform.

#### Acceptance Criteria

1. WHEN a user navigates to the profile page, THE Mini_Program SHALL display the user's avatar, nickname, bio, and statistics
2. WHEN a user taps the edit button, THE Mini_Program SHALL display an editable form with current profile data
3. WHEN a user submits profile changes, THE Mini_Program SHALL validate the input and send updates to the API_Service
4. WHEN profile update succeeds, THE Mini_Program SHALL display the updated profile and show a success message
5. IF profile update fails validation, THEN THE Mini_Program SHALL highlight invalid fields with error messages
6. WHEN a user taps to change avatar, THE Mini_Program SHALL allow selecting an image from the album or camera

### Requirement 3: 卡片创建

**User Story:** As a user, I want to create life cards to share my experiences, so that others can discover and exchange them.

#### Acceptance Criteria

1. WHEN a user taps the create button, THE Mini_Program SHALL display a card creation form
2. THE Mini_Program SHALL require the user to select a Card_Type before proceeding
3. THE Mini_Program SHALL require a title (max 200 characters) and description for the card
4. WHEN a user adds media, THE Mini_Program SHALL support uploading up to 9 images or 1 video
5. WHEN a user adds location, THE Mini_Program SHALL use WeChat location API to get current position or allow manual selection
6. THE Mini_Program SHALL allow adding up to 10 emotion tags and 10 interest tags
7. THE Mini_Program SHALL allow selecting a Privacy_Level (default: public)
8. WHEN the user submits the card, THE Mini_Program SHALL validate all fields and send to the API_Service
9. WHEN card creation succeeds, THE Mini_Program SHALL navigate to the card detail page and show earned coins
10. IF card creation fails, THEN THE Mini_Program SHALL display the error and preserve the form data

### Requirement 4: 卡片浏览与发现

**User Story:** As a user, I want to browse and discover life cards, so that I can find interesting experiences to exchange.

#### Acceptance Criteria

1. WHEN a user opens the home page, THE Mini_Program SHALL display a personalized Feed of cards
2. THE Mini_Program SHALL support infinite scroll loading with cursor-based pagination
3. WHEN a user pulls down to refresh, THE Mini_Program SHALL reload the Feed from the beginning
4. THE Mini_Program SHALL display each card with thumbnail, title, creator info, and interaction counts
5. WHEN a user taps a card, THE Mini_Program SHALL navigate to the card detail page
6. THE Mini_Program SHALL provide tabs for Feed, Hot cards, and Random discovery
7. WHEN viewing Hot cards, THE Mini_Program SHALL allow filtering by time range (day/week/month)

### Requirement 5: 卡片搜索

**User Story:** As a user, I want to search for cards by keywords and filters, so that I can find specific types of experiences.

#### Acceptance Criteria

1. WHEN a user taps the search icon, THE Mini_Program SHALL display a search interface
2. THE Mini_Program SHALL support keyword search across card titles and descriptions
3. THE Mini_Program SHALL support filtering by Card_Type
4. THE Mini_Program SHALL support filtering by interest tags
5. WHEN location permission is granted, THE Mini_Program SHALL support nearby card search with adjustable radius
6. WHEN search is executed, THE Mini_Program SHALL display results with pagination
7. IF no results are found, THEN THE Mini_Program SHALL display an empty state with suggestions

### Requirement 6: 卡片详情与互动

**User Story:** As a user, I want to view card details and interact with cards, so that I can engage with content I find interesting.

#### Acceptance Criteria

1. WHEN viewing a card detail, THE Mini_Program SHALL display all card information including media, location, and tags
2. THE Mini_Program SHALL display the creator's profile summary with a link to their profile
3. WHEN a user taps the like button, THE Mini_Program SHALL toggle the like state and update the count
4. WHEN a user taps the comment button, THE Mini_Program SHALL display comments and allow adding new comments
5. WHEN a user submits a comment, THE Mini_Program SHALL validate content and send to the API_Service
6. THE Mini_Program SHALL display the exchange price and an exchange button for cards the user doesn't own
7. WHEN viewing own cards, THE Mini_Program SHALL display edit and delete options

### Requirement 7: 卡片交换

**User Story:** As a user, I want to exchange cards with others, so that I can collect interesting life experiences.

#### Acceptance Criteria

1. WHEN a user taps the exchange button, THE Mini_Program SHALL display the exchange price and confirm dialog
2. IF the user has insufficient coins, THEN THE Mini_Program SHALL display the balance and prevent exchange
3. WHEN the user confirms exchange, THE Mini_Program SHALL send the request to the API_Service
4. WHEN exchange request is sent, THE Mini_Program SHALL show pending status and notify the card owner
5. WHEN an exchange request is received, THE Mini_Program SHALL display it in the notifications
6. THE Mini_Program SHALL allow the card owner to accept or reject exchange requests
7. WHEN exchange is accepted, THE Mini_Program SHALL add the card to the requester's collection and transfer coins
8. THE Mini_Program SHALL display exchange history in the user's profile

### Requirement 8: 卡片收藏管理

**User Story:** As a user, I want to organize my collected cards, so that I can easily find and review them.

#### Acceptance Criteria

1. WHEN a user navigates to My Cards, THE Mini_Program SHALL display tabs for Created and Collected cards
2. THE Mini_Program SHALL support creating folders to organize collected cards
3. WHEN a user creates a folder, THE Mini_Program SHALL validate the name and create via API_Service
4. THE Mini_Program SHALL allow moving cards between folders
5. THE Mini_Program SHALL allow renaming and deleting folders
6. THE Mini_Program SHALL display cards in timeline view grouped by date
7. THE Mini_Program SHALL display cards by category view grouped by Card_Type

### Requirement 9: 社交功能

**User Story:** As a user, I want to follow other users and see their activities, so that I can build connections.

#### Acceptance Criteria

1. WHEN viewing another user's profile, THE Mini_Program SHALL display a follow/unfollow button
2. WHEN a user taps follow, THE Mini_Program SHALL send the request and update the UI immediately
3. THE Mini_Program SHALL display follower and following counts on user profiles
4. WHEN a user taps followers/following count, THE Mini_Program SHALL display the list with pagination
5. THE Mini_Program SHALL indicate mutual follow status on user profiles

### Requirement 10: 通知与消息

**User Story:** As a user, I want to receive notifications about interactions, so that I can stay engaged with the community.

#### Acceptance Criteria

1. THE Mini_Program SHALL display a notification badge when there are unread notifications
2. WHEN a user opens notifications, THE Mini_Program SHALL display exchange requests, comments, and likes
3. THE Mini_Program SHALL group notifications by type and show timestamps
4. WHEN a user taps a notification, THE Mini_Program SHALL navigate to the relevant content
5. THE Mini_Program SHALL support marking notifications as read

### Requirement 11: 虚拟货币与余额

**User Story:** As a user, I want to view my coin balance and transaction history, so that I can manage my virtual currency.

#### Acceptance Criteria

1. THE Mini_Program SHALL display the current coin balance in the profile and header
2. WHEN a user taps the balance, THE Mini_Program SHALL display transaction history
3. THE Mini_Program SHALL show coin earnings from card creation with breakdown
4. THE Mini_Program SHALL show coin spending from exchanges
5. THE Mini_Program SHALL display each transaction with amount, type, and timestamp

### Requirement 12: 小程序分享

**User Story:** As a user, I want to share cards to WeChat friends and moments, so that I can spread interesting content.

#### Acceptance Criteria

1. WHEN viewing a card detail, THE Mini_Program SHALL provide a share button
2. WHEN a user shares a card, THE Mini_Program SHALL generate a share card with thumbnail and title
3. THE Mini_Program SHALL support sharing to WeChat friends via message
4. THE Mini_Program SHALL support generating a poster image for sharing to moments
5. WHEN a shared link is opened, THE Mini_Program SHALL navigate directly to the card detail
