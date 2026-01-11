-- Life Card MVP Initial Schema
-- Custom Types
CREATE TYPE card_type AS ENUM ('day_card', 'week_card', 'fragment_card', 'moment_card');
CREATE TYPE privacy_level AS ENUM ('public', 'friends_only', 'exchange_only');
CREATE TYPE exchange_status AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'expired');

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  wechat_openid VARCHAR(100) UNIQUE,
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
  media JSONB DEFAULT '[]'::jsonb,
  location JSONB,
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
  action VARCHAR(20) NOT NULL,
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
