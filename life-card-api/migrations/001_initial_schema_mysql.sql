-- Life Card MVP Initial Schema for MySQL 8.0

-- Users Table
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  wechat_openid VARCHAR(100) UNIQUE,
  nickname VARCHAR(100),
  avatar_url VARCHAR(500),
  bio TEXT,
  age_range VARCHAR(20),
  location VARCHAR(200),
  coin_balance INT DEFAULT 100,
  level INT DEFAULT 1,
  card_count INT DEFAULT 0,
  exchange_count INT DEFAULT 0,
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_coin_balance CHECK (coin_balance >= 0)
);

-- User Interest Tags
CREATE TABLE user_interest_tags (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_tag (user_id, tag),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Follow Relations
CREATE TABLE follows (
  id CHAR(36) PRIMARY KEY,
  follower_id CHAR(36) NOT NULL,
  followee_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_follow (follower_id, followee_id),
  CONSTRAINT chk_no_self_follow CHECK (follower_id != followee_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (followee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Coin Transactions
CREATE TABLE coin_transactions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  amount INT NOT NULL,
  reason VARCHAR(50) NOT NULL,
  reference_id CHAR(36),
  balance_after INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Life Cards Table (using JSON for flexible content)
CREATE TABLE cards (
  id CHAR(36) PRIMARY KEY,
  creator_id CHAR(36) NOT NULL,
  card_type ENUM('day_card', 'week_card', 'fragment_card', 'moment_card') NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  media JSON DEFAULT (JSON_ARRAY()),
  location JSON,
  emotion_tags JSON DEFAULT (JSON_ARRAY()),
  interest_tags JSON DEFAULT (JSON_ARRAY()),
  privacy_level ENUM('public', 'friends_only', 'exchange_only') DEFAULT 'public',
  base_price INT DEFAULT 10,
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  exchange_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  hot_score DOUBLE DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);


-- Card Likes
CREATE TABLE card_likes (
  id CHAR(36) PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_card_like (card_id, user_id),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Card Comments
CREATE TABLE card_comments (
  id CHAR(36) PRIMARY KEY,
  card_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Exchange Requests
CREATE TABLE exchange_requests (
  id CHAR(36) PRIMARY KEY,
  requester_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  coin_amount INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected', 'cancelled', 'expired') DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (card_id) REFERENCES cards(id),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Exchange Records (completed exchanges)
CREATE TABLE exchange_records (
  id CHAR(36) PRIMARY KEY,
  exchange_request_id CHAR(36),
  card_id CHAR(36) NOT NULL,
  from_user_id CHAR(36) NOT NULL,
  to_user_id CHAR(36) NOT NULL,
  coin_amount INT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exchange_request_id) REFERENCES exchange_requests(id),
  FOREIGN KEY (card_id) REFERENCES cards(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- Card Collections (user's collected cards)
CREATE TABLE card_collections (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  folder_id CHAR(36),
  collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_card (user_id, card_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Collection Folders
CREATE TABLE collection_folders (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Behaviors (for recommendations)
CREATE TABLE user_behaviors (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  card_id CHAR(36) NOT NULL,
  action VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
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
-- MySQL 8.0 supports JSON indexes via generated columns or functional indexes
-- For full-text search on title and description
CREATE FULLTEXT INDEX idx_cards_fulltext ON cards(title, description);

CREATE INDEX idx_card_likes_card ON card_likes(card_id);
CREATE INDEX idx_card_likes_user ON card_likes(user_id);
CREATE INDEX idx_card_comments_card ON card_comments(card_id);

CREATE INDEX idx_exchange_requests_requester ON exchange_requests(requester_id);
CREATE INDEX idx_exchange_requests_owner ON exchange_requests(owner_id);
CREATE INDEX idx_exchange_requests_status ON exchange_requests(status);

CREATE INDEX idx_card_collections_user ON card_collections(user_id);
CREATE INDEX idx_user_behaviors_user ON user_behaviors(user_id, created_at DESC);
CREATE INDEX idx_user_behaviors_card ON user_behaviors(card_id);
