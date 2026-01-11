# Design Document: Life Card MVP

## Overview

人生卡片App MVP版本采用微服务架构，实现用户管理、卡片管理、交换系统和推荐引擎四个核心服务。前端使用React Native实现跨平台移动应用，后端使用Rust构建高性能RESTful API，数据层采用PostgreSQL统一存储（利用JSONB支持灵活的卡片内容）、Redis提供缓存支持。

### 技术栈选择

**前端：**
- React Native - 跨平台移动开发
- TypeScript - 类型安全
- Redux Toolkit - 状态管理
- React Navigation - 导航管理

**后端：**
- Rust - 高性能、内存安全的系统编程语言
- Axum - 现代化的Rust Web框架，基于Tokio异步运行时
- SQLx - 编译时检查的异步SQL库
- PostgreSQL - 统一数据存储（用户、卡片、交易），利用JSONB存储灵活的卡片内容
- Redis - 缓存和会话管理
- JWT (jsonwebtoken crate) - 身份认证
- Serde - 序列化/反序列化

**Rust 核心依赖：**
- `axum` - Web框架
- `tokio` - 异步运行时
- `sqlx` - 数据库访问
- `redis` - Redis客户端
- `serde` / `serde_json` - JSON序列化
- `jsonwebtoken` - JWT处理
- `argon2` - 密码哈希
- `uuid` - UUID生成
- `chrono` - 时间处理
- `validator` - 输入验证
- `proptest` - 属性测试框架

**基础设施：**
- AWS S3 / 阿里云OSS - 媒体文件存储
- CDN - 静态资源加速
- Docker - 容器化部署

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mobile App (React Native)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  首页    │ │ 交换中心 │ │ 我的人生 │ │   创作   │           │
│  │  Feed    │ │ Exchange │ │Collection│ │  Create  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Rust API Server (Axum)                         │
│                   (Authentication, Rate Limiting)                │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ User Module   │    │ Card Module   │    │Exchange Module │
│               │    │               │    │               │
│ - Auth        │    │ - CRUD        │    │ - Matching    │
│ - Profile     │    │ - Search      │    │ - Transaction │
│ - Coins       │    │ - Media       │    │ - History     │
│ - Follow      │    │ - Tags        │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
              ┌───────────────────────────────┐
              │         PostgreSQL            │
              │  (Users, Cards, Relations,    │
              │   Transactions, Comments)     │
              │   - JSONB for flexible data   │
              └───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      ┌───────────────┐              ┌───────────────┐
      │    Redis      │              │Recommendation │
      │ (Cache,       │              │   Engine      │
      │  Sessions,    │              │               │
      │  Rankings)    │              │ - Tag-based   │
      └───────────────┘              │ - Collaborative│
                                     └───────────────┘
```

## Components and Interfaces

### 1. User Module

```rust
// User Service Trait
#[async_trait]
pub trait UserService: Send + Sync {
    // Authentication
    async fn register(&self, email: &str, password: &str) -> Result<AuthResult, AppError>;
    async fn login(&self, email: &str, password: &str) -> Result<AuthResult, AppError>;
    async fn logout(&self, user_id: &Uuid) -> Result<(), AppError>;
    async fn reset_password(&self, email: &str) -> Result<(), AppError>;
    
    // Profile Management
    async fn get_profile(&self, user_id: &Uuid) -> Result<UserProfile, AppError>;
    async fn update_profile(&self, user_id: &Uuid, data: ProfileUpdateData) -> Result<UserProfile, AppError>;
    async fn upload_avatar(&self, user_id: &Uuid, file_data: Vec<u8>) -> Result<String, AppError>;
    
    // Interest Tags
    async fn set_interest_tags(&self, user_id: &Uuid, tags: Vec<String>) -> Result<(), AppError>;
    async fn get_interest_tags(&self, user_id: &Uuid) -> Result<Vec<String>, AppError>;
    
    // Experience Coins
    async fn get_coin_balance(&self, user_id: &Uuid) -> Result<i32, AppError>;
    async fn add_coins(&self, user_id: &Uuid, amount: i32, reason: CoinReason) -> Result<i32, AppError>;
    async fn deduct_coins(&self, user_id: &Uuid, amount: i32, reason: CoinReason) -> Result<i32, AppError>;
    async fn get_coin_history(&self, user_id: &Uuid, pagination: Pagination) -> Result<Vec<CoinTransaction>, AppError>;
    
    // Social Relations
    async fn follow_user(&self, follower_id: &Uuid, followee_id: &Uuid) -> Result<(), AppError>;
    async fn unfollow_user(&self, follower_id: &Uuid, followee_id: &Uuid) -> Result<(), AppError>;
    async fn get_followers(&self, user_id: &Uuid, pagination: Pagination) -> Result<Vec<UserSummary>, AppError>;
    async fn get_following(&self, user_id: &Uuid, pagination: Pagination) -> Result<Vec<UserSummary>, AppError>;
}

// Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResult {
    pub token: String,
    pub user: UserProfile,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: Uuid,
    pub email: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CoinReason {
    CardCreated,
    CardExchanged,
    DailyLogin,
    ExchangePurchase,
    ExchangeRefund,
}
```

### 2. Card Module

```rust
// Card Service Trait
#[async_trait]
pub trait CardService: Send + Sync {
    // CRUD Operations
    async fn create_card(&self, user_id: &Uuid, data: CardCreateData) -> Result<LifeCard, AppError>;
    async fn get_card(&self, card_id: &Uuid, viewer_id: Option<&Uuid>) -> Result<Option<LifeCard>, AppError>;
    async fn update_card(&self, card_id: &Uuid, user_id: &Uuid, data: CardUpdateData) -> Result<LifeCard, AppError>;
    async fn delete_card(&self, card_id: &Uuid, user_id: &Uuid) -> Result<(), AppError>;
    
    // Media Management
    async fn upload_media(&self, card_id: &Uuid, files: Vec<Vec<u8>>) -> Result<Vec<MediaItem>, AppError>;
    async fn delete_media(&self, card_id: &Uuid, media_id: &Uuid) -> Result<(), AppError>;
    
    // Discovery & Search
    async fn get_feed(&self, user_id: &Uuid, pagination: Pagination) -> Result<CardFeedResult, AppError>;
    async fn search_cards(&self, query: SearchQuery, pagination: Pagination) -> Result<CardSearchResult, AppError>;
    async fn get_hot_cards(&self, time_range: TimeRange, pagination: Pagination) -> Result<Vec<LifeCard>, AppError>;
    async fn get_random_cards(&self, count: usize, exclude_ids: Vec<Uuid>) -> Result<Vec<LifeCard>, AppError>;
    
    // Collection Management
    async fn get_user_cards(&self, user_id: &Uuid, pagination: Pagination) -> Result<Vec<LifeCard>, AppError>;
    async fn get_collected_cards(&self, user_id: &Uuid, pagination: Pagination) -> Result<Vec<LifeCard>, AppError>;
    async fn create_folder(&self, user_id: &Uuid, name: &str) -> Result<CardFolder, AppError>;
    async fn move_to_folder(&self, card_id: &Uuid, folder_id: &Uuid) -> Result<(), AppError>;
    async fn get_folders(&self, user_id: &Uuid) -> Result<Vec<CardFolder>, AppError>;
    
    // Social Interactions
    async fn like_card(&self, card_id: &Uuid, user_id: &Uuid) -> Result<(), AppError>;
    async fn unlike_card(&self, card_id: &Uuid, user_id: &Uuid) -> Result<(), AppError>;
    async fn add_comment(&self, card_id: &Uuid, user_id: &Uuid, content: &str) -> Result<Comment, AppError>;
    async fn delete_comment(&self, comment_id: &Uuid, user_id: &Uuid) -> Result<(), AppError>;
    async fn get_comments(&self, card_id: &Uuid, pagination: Pagination) -> Result<Vec<Comment>, AppError>;
}

// Types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LifeCard {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub creator: Option<UserSummary>,
    pub card_type: CardType,
    pub title: String,
    pub description: String,
    pub media: Vec<MediaItem>,
    pub location: Option<Location>,
    pub emotion_tags: Vec<String>,
    pub interest_tags: Vec<String>,
    pub privacy_level: PrivacyLevel,
    pub exchange_price: i32,
    pub like_count: i32,
    pub comment_count: i32,
    pub exchange_count: i32,
    pub is_liked: bool,
    pub is_collected: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "card_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CardType {
    DayCard,      // 一天体验卡
    WeekCard,     // 一周体验卡
    FragmentCard, // 人生片段卡
    MomentCard,   // 重要时刻卡
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "privacy_level", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PrivacyLevel {
    Public,       // 公开
    FriendsOnly,  // 好友可见
    ExchangeOnly, // 仅交换可见
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaItem {
    pub id: Uuid,
    pub media_type: MediaType,
    pub url: String,
    pub thumbnail_url: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MediaType {
    Image,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Location {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub keyword: Option<String>,
    pub card_type: Option<CardType>,
    pub interest_tags: Option<Vec<String>>,
    pub location: Option<LocationFilter>,
    pub creator_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationFilter {
    pub latitude: f64,
    pub longitude: f64,
    pub radius_km: f64,
}
```

### 3. Exchange Module

```rust
// Exchange Service Trait
#[async_trait]
pub trait ExchangeService: Send + Sync {
    // Exchange Operations
    async fn create_exchange_request(
        &self,
        requester_id: &Uuid,
        card_id: &Uuid,
    ) -> Result<ExchangeRequest, AppError>;
    
    async fn accept_exchange(
        &self,
        exchange_id: &Uuid,
        owner_id: &Uuid,
    ) -> Result<ExchangeResult, AppError>;
    
    async fn reject_exchange(
        &self,
        exchange_id: &Uuid,
        owner_id: &Uuid,
    ) -> Result<(), AppError>;
    
    async fn cancel_exchange(
        &self,
        exchange_id: &Uuid,
        requester_id: &Uuid,
    ) -> Result<(), AppError>;
    
    // Query Operations
    async fn get_pending_requests(&self, user_id: &Uuid) -> Result<Vec<ExchangeRequest>, AppError>;
    async fn get_sent_requests(&self, user_id: &Uuid) -> Result<Vec<ExchangeRequest>, AppError>;
    async fn get_exchange_history(
        &self,
        user_id: &Uuid,
        pagination: Pagination,
    ) -> Result<Vec<ExchangeRecord>, AppError>;
    
    // Price Calculation
    async fn calculate_exchange_price(&self, card_id: &Uuid) -> Result<i32, AppError>;
    
    // Auto-expiration (called by scheduler)
    async fn process_expired_requests(&self) -> Result<(), AppError>;
}

// Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRequest {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub requester: Option<UserSummary>,
    pub card_id: Uuid,
    pub card: Option<LifeCardSummary>,
    pub owner_id: Uuid,
    pub owner: Option<UserSummary>,
    pub coin_amount: i32,
    pub status: ExchangeStatus,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, sqlx::Type)]
#[sqlx(type_name = "exchange_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ExchangeStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeResult {
    pub exchange_id: Uuid,
    pub card_id: Uuid,
    pub requester_new_balance: i32,
    pub owner_new_balance: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRecord {
    pub id: Uuid,
    pub card_id: Uuid,
    pub card: Option<LifeCardSummary>,
    pub counterparty_id: Uuid,
    pub counterparty: Option<UserSummary>,
    pub direction: ExchangeDirection,
    pub coin_amount: i32,
    pub completed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExchangeDirection {
    Sent,
    Received,
}
```

### 4. Recommendation Engine

```rust
// Recommendation Engine Trait
#[async_trait]
pub trait RecommendationEngine: Send + Sync {
    // Personalized Recommendations
    async fn get_personalized_feed(
        &self,
        user_id: &Uuid,
        pagination: Pagination,
    ) -> Result<Vec<LifeCard>, AppError>;
    
    // Similar Cards
    async fn get_similar_cards(
        &self,
        card_id: &Uuid,
        limit: usize,
    ) -> Result<Vec<LifeCard>, AppError>;
    
    // User Behavior Tracking
    async fn record_view(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError>;
    async fn record_like(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError>;
    async fn record_exchange(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError>;
    
    // Hot Rankings
    async fn update_hot_rankings(&self) -> Result<(), AppError>;
    async fn get_hot_rankings(
        &self,
        time_range: TimeRange,
        limit: usize,
    ) -> Result<Vec<LifeCard>, AppError>;
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TimeRange {
    Day,
    Week,
    Month,
}

// Common Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pagination {
    pub page: i32,
    pub page_size: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: Uuid,
    pub nickname: Option<String>,
    pub avatar: Option<String>,
    pub level: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LifeCardSummary {
    pub id: Uuid,
    pub title: String,
    pub card_type: CardType,
    pub thumbnail: Option<String>,
}
```

## Data Models

### PostgreSQL Schema (Unified Storage)

```sql
-- Custom Types
CREATE TYPE card_type AS ENUM ('day_card', 'week_card', 'fragment_card', 'moment_card');
CREATE TYPE privacy_level AS ENUM ('public', 'friends_only', 'exchange_only');
CREATE TYPE exchange_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  avatar_url VARCHAR(500),
  bio TEXT,
  age_range VARCHAR(20),
  location VARCHAR(200),
  coin_balance INTEGER DEFAULT 100 CHECK (coin_balance >= 0),
  level INTEGER DEFAULT 1,
  card_count INTEGER DEFAULT 0,
  exchange_count INTEGER DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User Interest Tags
CREATE TABLE user_interest_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, tag)
);

-- Follow Relations
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, followee_id),
  CHECK (follower_id != followee_id)
);

-- Coin Transactions
CREATE TABLE coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason VARCHAR(50) NOT NULL,
  reference_id UUID,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Life Cards Table (using JSONB for flexible content)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_type card_type NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  media JSONB DEFAULT '[]'::jsonb,  -- Array of MediaItem
  location JSONB,  -- { name, latitude, longitude }
  emotion_tags TEXT[] DEFAULT '{}',
  interest_tags TEXT[] DEFAULT '{}',
  privacy_level privacy_level DEFAULT 'public',
  base_price INTEGER DEFAULT 10,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  exchange_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  hot_score FLOAT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Card Likes
CREATE TABLE card_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(card_id, user_id)
);

-- Card Comments
CREATE TABLE card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Exchange Requests
CREATE TABLE exchange_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id),
  card_id UUID REFERENCES cards(id),
  owner_id UUID REFERENCES users(id),
  coin_amount INTEGER NOT NULL,
  status exchange_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Exchange Records (completed exchanges)
CREATE TABLE exchange_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_request_id UUID REFERENCES exchange_requests(id),
  card_id UUID REFERENCES cards(id),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  coin_amount INTEGER NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Card Collections (user's collected cards)
CREATE TABLE card_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  folder_id UUID,
  collected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, card_id)
);

-- Collection Folders
CREATE TABLE collection_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User Behaviors (for recommendations)
CREATE TABLE user_behaviors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL,  -- 'view', 'like', 'exchange', 'comment'
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_followee ON follows(followee_id);
CREATE INDEX idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_transactions_created ON coin_transactions(created_at DESC);

CREATE INDEX idx_cards_creator ON cards(creator_id);
CREATE INDEX idx_cards_type ON cards(card_type);
CREATE INDEX idx_cards_privacy ON cards(privacy_level);
CREATE INDEX idx_cards_hot_score ON cards(hot_score DESC);
CREATE INDEX idx_cards_created ON cards(created_at DESC);
CREATE INDEX idx_cards_interest_tags ON cards USING GIN(interest_tags);
CREATE INDEX idx_cards_emotion_tags ON cards USING GIN(emotion_tags);
CREATE INDEX idx_cards_search ON cards USING GIN(to_tsvector('simple', title || ' ' || description));

CREATE INDEX idx_card_likes_card ON card_likes(card_id);
CREATE INDEX idx_card_likes_user ON card_likes(user_id);
CREATE INDEX idx_card_comments_card ON card_comments(card_id);

CREATE INDEX idx_exchange_requests_requester ON exchange_requests(requester_id);
CREATE INDEX idx_exchange_requests_owner ON exchange_requests(owner_id);
CREATE INDEX idx_exchange_requests_status ON exchange_requests(status);
CREATE INDEX idx_exchange_requests_expires ON exchange_requests(expires_at) WHERE status = 'pending';

CREATE INDEX idx_card_collections_user ON card_collections(user_id);
CREATE INDEX idx_user_behaviors_user ON user_behaviors(user_id, created_at DESC);
CREATE INDEX idx_user_behaviors_card ON user_behaviors(card_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchange_requests_updated_at BEFORE UPDATE ON exchange_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Redis Data Structures

```rust
// Session Storage
// Key: session:{token}
// Value: JSON { user_id, created_at, expires_at }
// TTL: 7 days

// User Coin Balance Cache
// Key: user:coins:{user_id}
// Value: balance (integer)
// TTL: 1 hour

// Hot Rankings Cache
// Key: hot:cards:{time_range}
// Value: Sorted Set (card_id -> hot_score)
// TTL: 1 hour for day, 6 hours for week

// User Feed Cache
// Key: feed:{user_id}
// Value: List of card_ids
// TTL: 30 minutes

// Card View Count (for hot score calculation)
// Key: card:views:{card_id}:{date}
// Value: count (integer)
// TTL: 7 days

// Rate Limiting
// Key: rate:{user_id}:{endpoint}
// Value: request count
// TTL: 1 minute
```

### Project Structure

```
life-card-api/
├── Cargo.toml
├── Cargo.lock
├── .env.example
├── migrations/
│   └── 001_initial_schema.sql
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── config.rs
│   ├── error.rs
│   ├── models/
│   │   ├── mod.rs
│   │   ├── user.rs
│   │   ├── card.rs
│   │   ├── exchange.rs
│   │   └── common.rs
│   ├── services/
│   │   ├── mod.rs
│   │   ├── user_service.rs
│   │   ├── card_service.rs
│   │   ├── exchange_service.rs
│   │   └── recommendation_service.rs
│   ├── handlers/
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   ├── user.rs
│   │   ├── card.rs
│   │   └── exchange.rs
│   ├── middleware/
│   │   ├── mod.rs
│   │   ├── auth.rs
│   │   └── rate_limit.rs
│   ├── db/
│   │   ├── mod.rs
│   │   └── postgres.rs
│   └── utils/
│       ├── mod.rs
│       ├── jwt.rs
│       ├── password.rs
│       └── validation.rs
└── tests/
    ├── common/
    │   └── mod.rs
    ├── unit/
    │   ├── user_tests.rs
    │   ├── card_tests.rs
    │   └── exchange_tests.rs
    └── property/
        ├── user_property_tests.rs
        ├── card_property_tests.rs
        └── exchange_property_tests.rs
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


Based on the acceptance criteria analysis, the following correctness properties have been identified for property-based testing:

### Property 1: User Registration Round-Trip
*For any* valid email and password combination, registering a user and then logging in with the same credentials SHALL return a valid authentication token and the user profile should match the registration data.
**Validates: Requirements 1.1, 1.4**

### Property 2: Input Validation Rejection
*For any* invalid input (malformed email, empty required fields, incorrect credentials), THE System SHALL reject the operation and return appropriate validation errors without modifying system state.
**Validates: Requirements 1.2, 1.5, 3.8**

### Property 3: New User Initialization Invariant
*For any* newly registered user, THE User_Service SHALL initialize the user with default experience coin balance (100 coins) and level 1.
**Validates: Requirements 1.7**

### Property 4: Profile Update Round-Trip
*For any* valid profile update data (nickname, bio, interest tags), updating a user's profile and then retrieving it SHALL return data equivalent to the update input.
**Validates: Requirements 2.1, 2.3**

### Property 5: Card Creation Round-Trip
*For any* valid card creation data (title, description, card type, tags), creating a card and then retrieving it SHALL return a card with equivalent data, a valid creation timestamp, and the creator's coin balance should increase.
**Validates: Requirements 3.2, 3.9, 3.10**

### Property 6: Tag Association Completeness
*For any* card with emotion tags and interest tags, all tags provided during creation or update SHALL be associated with the card and retrievable.
**Validates: Requirements 3.5, 3.6**

### Property 7: Privacy Enforcement
*For any* card with a specific privacy level, THE Card_System SHALL only return the card to users who satisfy the privacy constraints (public: all users, friends_only: followers, exchange_only: users who have exchanged).
**Validates: Requirements 3.7, 4.7**

### Property 8: Search and Filter Accuracy
*For any* search query or filter criteria (keyword, card type, interest category, location), all returned cards SHALL match the specified criteria. No card that matches the criteria should be excluded (completeness), and no card that doesn't match should be included (soundness).
**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

### Property 9: Pagination Correctness
*For any* paginated request with page size N, THE System SHALL return at most N items per page, items should not repeat across pages, and the union of all pages should equal the complete result set.
**Validates: Requirements 4.8**

### Property 10: Exchange Flow Integrity
*For any* exchange request flow (create → accept/reject/expire), THE Exchange_Service SHALL maintain the following invariants:
- Requester's coins are deducted on request creation
- Coins are refunded on rejection or expiration
- Card access is granted only on acceptance
- Owner receives coins only on acceptance
- Total coins in the system remain constant (conservation)
**Validates: Requirements 5.1, 5.3, 5.4, 5.5**

### Property 11: Coin Balance Invariant
*For any* user at any point in time, the user's coin balance SHALL equal the sum of all their coin transactions, and the balance SHALL never be negative.
**Validates: Requirements 6.4, 6.6**

### Property 12: Collection Completeness
*For any* user, "My Cards" SHALL contain exactly all cards created by that user, and "Collected Cards" SHALL contain exactly all cards obtained through exchange.
**Validates: Requirements 7.1, 7.2**

### Property 13: Card Deletion Constraints
*For any* card deletion attempt, THE Card_System SHALL allow deletion only if the card has not been exchanged to other users. Deleted cards SHALL not be retrievable.
**Validates: Requirements 7.5, 7.6**

### Property 14: Like/Unlike Idempotence
*For any* card and user, liking a card should increment the like count by exactly 1, unliking should decrement by exactly 1, and the like count should equal the number of distinct users who have liked the card.
**Validates: Requirements 8.1, 8.2**

### Property 15: Follow Relationship Consistency
*For any* follow/unfollow operation, THE User_Service SHALL maintain consistent follower and following counts that match the actual relationship records.
**Validates: Requirements 8.5, 8.6, 8.7**

### Property 16: Card Serialization Round-Trip
*For any* valid Life_Card object, serializing to JSON and then deserializing SHALL produce an object equivalent to the original.
**Validates: Requirements 9.4**

### Property 17: API Response Consistency
*For any* API endpoint, THE System SHALL return responses with consistent structure including appropriate HTTP status codes, error messages for failures, and pagination metadata for list endpoints.
**Validates: Requirements 10.1-10.8**

## Error Handling

### Error Categories

1. **Validation Errors (400)**
   - Invalid email format
   - Missing required fields
   - Invalid card type
   - Invalid privacy level
   - File size/format violations

2. **Authentication Errors (401)**
   - Invalid or expired token
   - Missing authentication header

3. **Authorization Errors (403)**
   - Attempting to modify another user's card
   - Attempting to delete exchanged card
   - Accessing private card without permission

4. **Not Found Errors (404)**
   - User not found
   - Card not found
   - Exchange request not found

5. **Business Logic Errors (422)**
   - Insufficient coin balance
   - Exchange request already processed
   - Cannot exchange own card

6. **Server Errors (500)**
   - Database connection failure
   - External service failure (storage, email)

### Error Response Format

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub success: bool,  // always false
    pub error: ErrorDetail,
    pub timestamp: DateTime<Utc>,
    pub request_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: String,           // e.g., "VALIDATION_ERROR", "INSUFFICIENT_BALANCE"
    pub message: String,        // Human-readable message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<HashMap<String, Vec<String>>>,  // Field-specific errors
}

// Custom Error Type
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Validation error: {0}")]
    Validation(String),
    
    #[error("Authentication required")]
    Unauthorized,
    
    #[error("Access denied")]
    Forbidden,
    
    #[error("Resource not found: {0}")]
    NotFound(String),
    
    #[error("Business logic error: {0}")]
    BusinessLogic(String),
    
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    
    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED", "Authentication required".to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "FORBIDDEN", "Access denied".to_string()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::BusinessLogic(msg) => (StatusCode::UNPROCESSABLE_ENTITY, "BUSINESS_ERROR", msg.clone()),
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR", "Database error".to_string()),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Internal server error".to_string()),
        };
        
        let body = Json(ErrorResponse {
            success: false,
            error: ErrorDetail {
                code: code.to_string(),
                message,
                details: None,
            },
            timestamp: Utc::now(),
            request_id: Uuid::new_v4().to_string(),
        });
        
        (status, body).into_response()
    }
}
```

### Retry and Recovery Strategies

1. **Transient Failures**: Implement exponential backoff for database and external service calls
2. **Transaction Rollback**: Use database transactions for multi-step operations (exchange flow)
3. **Idempotency Keys**: Support idempotency keys for exchange requests to prevent duplicate processing
4. **Circuit Breaker**: Implement circuit breaker pattern for external services (storage, email)

## Testing Strategy

### Unit Tests
Unit tests verify specific examples and edge cases using Rust's built-in test framework:

- User registration with various email formats
- Card creation with different card types
- Exchange flow state transitions
- Coin balance calculations
- Privacy level enforcement

### Property-Based Tests
Property-based tests verify universal properties across all inputs using **proptest** crate for Rust:

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: **Feature: life-card-mvp, Property {number}: {property_text}**

**Test Files Structure:**
```
tests/
├── common/
│   └── mod.rs              # Shared test utilities and generators
├── unit/
│   ├── user_tests.rs       # Unit tests for user module
│   ├── card_tests.rs       # Unit tests for card module
│   └── exchange_tests.rs   # Unit tests for exchange module
└── property/
    ├── user_property_tests.rs      # Property tests for user module
    ├── card_property_tests.rs      # Property tests for card module
    └── exchange_property_tests.rs  # Property tests for exchange module
```

**Property Test Example:**
```rust
use proptest::prelude::*;
use crate::models::card::LifeCard;

// Feature: life-card-mvp, Property 16: Card Serialization Round-Trip
proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    #[test]
    fn card_serialization_roundtrip(card in valid_life_card_strategy()) {
        let serialized = serde_json::to_string(&card).unwrap();
        let deserialized: LifeCard = serde_json::from_str(&serialized).unwrap();
        prop_assert_eq!(card, deserialized);
    }
}
```

### Integration Tests
- API endpoint testing with `axum::test`
- Database integration tests with test containers
- Redis integration tests

### Test Data Generators (proptest strategies)
Custom strategies for property-based testing:

```rust
use proptest::prelude::*;
use uuid::Uuid;

// Email Generator
fn valid_email_strategy() -> impl Strategy<Value = String> {
    "[a-z]{5,10}@[a-z]{3,8}\\.(com|org|net)"
        .prop_filter("email length", |e| e.len() <= 255)
}

// Password Generator
fn valid_password_strategy() -> impl Strategy<Value = String> {
    "[A-Za-z0-9!@#$%]{8,20}"
        .prop_filter("has uppercase", |p| p.chars().any(|c| c.is_uppercase()))
        .prop_filter("has digit", |p| p.chars().any(|c| c.is_numeric()))
}

// Card Type Generator
fn card_type_strategy() -> impl Strategy<Value = CardType> {
    prop_oneof![
        Just(CardType::DayCard),
        Just(CardType::WeekCard),
        Just(CardType::FragmentCard),
        Just(CardType::MomentCard),
    ]
}

// Privacy Level Generator
fn privacy_level_strategy() -> impl Strategy<Value = PrivacyLevel> {
    prop_oneof![
        Just(PrivacyLevel::Public),
        Just(PrivacyLevel::FriendsOnly),
        Just(PrivacyLevel::ExchangeOnly),
    ]
}

// Life Card Generator
fn valid_life_card_strategy() -> impl Strategy<Value = LifeCard> {
    (
        any::<[u8; 16]>().prop_map(|b| Uuid::from_bytes(b)),
        any::<[u8; 16]>().prop_map(|b| Uuid::from_bytes(b)),
        card_type_strategy(),
        "[\\w\\s]{1,200}",  // title
        "[\\w\\s]{1,5000}", // description
        prop::collection::vec("[\\w]{1,50}", 0..10), // emotion_tags
        prop::collection::vec("[\\w]{1,50}", 0..10), // interest_tags
        privacy_level_strategy(),
    )
        .prop_map(|(id, creator_id, card_type, title, description, emotion_tags, interest_tags, privacy_level)| {
            LifeCard {
                id,
                creator_id,
                creator: None,
                card_type,
                title,
                description,
                media: vec![],
                location: None,
                emotion_tags,
                interest_tags,
                privacy_level,
                exchange_price: 10,
                like_count: 0,
                comment_count: 0,
                exchange_count: 0,
                is_liked: false,
                is_collected: false,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }
        })
}

// Coin Amount Generator (positive)
fn positive_coin_amount_strategy() -> impl Strategy<Value = i32> {
    1..1000i32
}

// Exchange Request Generator
fn exchange_request_strategy() -> impl Strategy<Value = (Uuid, Uuid, i32)> {
    (
        any::<[u8; 16]>().prop_map(|b| Uuid::from_bytes(b)),
        any::<[u8; 16]>().prop_map(|b| Uuid::from_bytes(b)),
        positive_coin_amount_strategy(),
    )
}
```

### Cargo.toml Dependencies for Testing

```toml
[dev-dependencies]
proptest = "1.4"
tokio-test = "0.4"
sqlx = { version = "0.7", features = ["runtime-tokio", "postgres", "testing"] }
testcontainers = "0.15"
fake = { version = "2.9", features = ["derive"] }
```
