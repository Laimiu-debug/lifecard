use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::models::card::{CardRow, LifeCard, TimeRange};
use crate::models::common::Pagination;
use crate::models::user::UserSummary;

/// User behavior action types for tracking
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BehaviorAction {
    View,
    Like,
    Exchange,
    Comment,
}

impl BehaviorAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            BehaviorAction::View => "view",
            BehaviorAction::Like => "like",
            BehaviorAction::Exchange => "exchange",
            BehaviorAction::Comment => "comment",
        }
    }
}

impl std::fmt::Display for BehaviorAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// User behavior record
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserBehavior {
    pub id: Uuid,
    pub user_id: Uuid,
    pub card_id: Uuid,
    pub action: String,
    pub created_at: DateTime<Utc>,
}

/// Recommendation service for tracking user behavior and generating recommendations
/// Requirements: 4.1
pub struct RecommendationService {
    pool: PgPool,
    redis: Option<redis::aio::ConnectionManager>,
}

/// Redis key prefixes for hot rankings cache
const HOT_RANKINGS_KEY_PREFIX: &str = "hot:cards:";
/// TTL for hot rankings cache (in seconds)
const HOT_RANKINGS_TTL_DAY: u64 = 3600; // 1 hour for daily rankings
const HOT_RANKINGS_TTL_WEEK: u64 = 21600; // 6 hours for weekly rankings
const HOT_RANKINGS_TTL_MONTH: u64 = 43200; // 12 hours for monthly rankings

impl RecommendationService {
    /// Create a new RecommendationService instance
    pub fn new(pool: PgPool) -> Self {
        Self { pool, redis: None }
    }

    /// Create a new RecommendationService instance with Redis connection
    pub fn with_redis(pool: PgPool, redis: redis::aio::ConnectionManager) -> Self {
        Self { pool, redis: Some(redis) }
    }

    /// Set Redis connection manager
    pub fn set_redis(&mut self, redis: redis::aio::ConnectionManager) {
        self.redis = Some(redis);
    }

    /// Record a user viewing a card
    /// Requirements: 4.1
    pub async fn record_view(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError> {
        self.record_behavior(user_id, card_id, BehaviorAction::View).await
    }

    /// Record a user liking a card
    /// Requirements: 4.1
    pub async fn record_like(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError> {
        self.record_behavior(user_id, card_id, BehaviorAction::Like).await
    }

    /// Record a user exchanging for a card
    /// Requirements: 4.1
    pub async fn record_exchange(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError> {
        self.record_behavior(user_id, card_id, BehaviorAction::Exchange).await
    }

    /// Record a user commenting on a card
    /// Requirements: 4.1
    pub async fn record_comment(&self, user_id: &Uuid, card_id: &Uuid) -> Result<(), AppError> {
        self.record_behavior(user_id, card_id, BehaviorAction::Comment).await
    }

    /// Internal method to record any behavior action
    async fn record_behavior(
        &self,
        user_id: &Uuid,
        card_id: &Uuid,
        action: BehaviorAction,
    ) -> Result<(), AppError> {
        // Verify user exists
        let user_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if user_exists == 0 {
            return Err(AppError::NotFound("User not found".to_string()));
        }

        // Verify card exists and is not deleted
        let card_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE id = $1 AND is_deleted = FALSE"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if card_exists == 0 {
            return Err(AppError::NotFound("Card not found".to_string()));
        }

        // Insert behavior record
        sqlx::query(
            r#"
            INSERT INTO user_behaviors (id, user_id, card_id, action)
            VALUES ($1, $2, $3, $4)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(card_id)
        .bind(action.as_str())
        .execute(&self.pool)
        .await?;

        // Update view count on the card if this is a view action
        if action == BehaviorAction::View {
            sqlx::query(
                "UPDATE cards SET view_count = view_count + 1 WHERE id = $1"
            )
            .bind(card_id)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Get user behavior history for a specific user
    pub async fn get_user_behaviors(
        &self,
        user_id: &Uuid,
        limit: i64,
    ) -> Result<Vec<UserBehavior>, AppError> {
        let behaviors = sqlx::query_as::<_, UserBehavior>(
            r#"
            SELECT id, user_id, card_id, action, created_at
            FROM user_behaviors
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(behaviors)
    }

    /// Get behavior count for a specific card and action type
    pub async fn get_card_behavior_count(
        &self,
        card_id: &Uuid,
        action: BehaviorAction,
    ) -> Result<i64, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM user_behaviors
            WHERE card_id = $1 AND action = $2
            "#,
        )
        .bind(card_id)
        .bind(action.as_str())
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    /// Check if a user has performed a specific action on a card
    pub async fn has_user_behavior(
        &self,
        user_id: &Uuid,
        card_id: &Uuid,
        action: BehaviorAction,
    ) -> Result<bool, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM user_behaviors
            WHERE user_id = $1 AND card_id = $2 AND action = $3
            "#,
        )
        .bind(user_id)
        .bind(card_id)
        .bind(action.as_str())
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    /// Get personalized feed for a user based on interest tags and behavior
    /// Prioritizes cards from followed users
    /// Requirements: 4.1, 8.8
    pub async fn get_personalized_feed(
        &self,
        user_id: &Uuid,
        pagination: &Pagination,
    ) -> Result<Vec<LifeCard>, AppError> {
        // Verify user exists
        let user_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if user_exists == 0 {
            return Err(AppError::NotFound("User not found".to_string()));
        }

        // Get user's interest tags for matching
        let user_interest_tags: Vec<String> = sqlx::query_scalar(
            "SELECT tag FROM user_interest_tags WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Get IDs of users that the current user follows
        let followed_user_ids: Vec<Uuid> = sqlx::query_scalar(
            "SELECT followee_id FROM follows WHERE follower_id = $1"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Get interest tags from user's recent behavior (liked/exchanged cards)
        let behavior_interest_tags: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT DISTINCT unnest(c.interest_tags) as tag
            FROM user_behaviors ub
            JOIN cards c ON ub.card_id = c.id
            WHERE ub.user_id = $1 
              AND ub.action IN ('like', 'exchange')
              AND ub.created_at > NOW() - INTERVAL '30 days'
              AND c.is_deleted = FALSE
            LIMIT 20
            "#
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Combine user interest tags with behavior-derived tags
        let mut all_interest_tags: Vec<String> = user_interest_tags;
        for tag in behavior_interest_tags {
            if !all_interest_tags.contains(&tag) {
                all_interest_tags.push(tag);
            }
        }

        let offset = pagination.offset();
        let limit = pagination.limit();

        // Build the personalized feed query
        // Priority scoring:
        // - Cards from followed users get highest priority (score boost of 1000)
        // - Cards matching user interest tags get medium priority (score boost per matching tag)
        // - Recent cards get slight boost
        // - Exclude user's own cards and already viewed cards
        let card_rows: Vec<CardRow> = sqlx::query_as(
            r#"
            WITH user_viewed_cards AS (
                SELECT DISTINCT card_id 
                FROM user_behaviors 
                WHERE user_id = $1 AND action = 'view'
            ),
            scored_cards AS (
                SELECT 
                    c.*,
                    CASE 
                        WHEN c.creator_id = ANY($2::uuid[]) THEN 1000 
                        ELSE 0 
                    END as follow_score,
                    COALESCE(
                        (SELECT COUNT(*) FROM unnest(c.interest_tags) t WHERE t = ANY($3::text[])),
                        0
                    ) * 10 as tag_score,
                    EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 86400.0 as days_old
                FROM cards c
                WHERE c.is_deleted = FALSE
                  AND c.creator_id != $1
                  AND c.privacy_level = 'public'
                  AND c.id NOT IN (SELECT card_id FROM user_viewed_cards)
            )
            SELECT 
                id, creator_id, card_type, title, description, media, location,
                emotion_tags, interest_tags, privacy_level, base_price,
                like_count, comment_count, exchange_count, view_count,
                hot_score, is_deleted, created_at, updated_at
            FROM scored_cards
            ORDER BY 
                follow_score DESC,
                tag_score DESC,
                hot_score DESC,
                created_at DESC
            OFFSET $4
            LIMIT $5
            "#
        )
        .bind(user_id)
        .bind(&followed_user_ids)
        .bind(&all_interest_tags)
        .bind(offset)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        // Convert card rows to LifeCard with creator info and like/collection status
        let mut cards = Vec::with_capacity(card_rows.len());
        for row in card_rows {
            // Get creator summary
            let creator: Option<UserSummary> = sqlx::query_as(
                r#"
                SELECT id, nickname, avatar_url as avatar, level
                FROM users WHERE id = $1
                "#
            )
            .bind(&row.creator_id)
            .fetch_optional(&self.pool)
            .await?;

            // Check if user has liked this card
            let is_liked = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM card_likes WHERE card_id = $1 AND user_id = $2"
            )
            .bind(&row.id)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await? > 0;

            // Check if user has collected this card
            let is_collected = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM card_collections WHERE card_id = $1 AND user_id = $2"
            )
            .bind(&row.id)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await? > 0;

            cards.push(row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(cards)
    }

    /// Update hot rankings for all cards
    /// Calculates hot score based on recent activity (views, likes, exchanges, comments)
    /// Requirements: 4.9
    pub async fn update_hot_rankings(&self) -> Result<(), AppError> {
        // Hot score formula:
        // score = (views * 1 + likes * 5 + exchanges * 10 + comments * 3) / (age_hours + 2)^1.5
        // This gives more weight to recent cards while still considering engagement
        
        // Update hot scores for all non-deleted public cards
        sqlx::query(
            r#"
            UPDATE cards
            SET hot_score = (
                SELECT 
                    COALESCE(
                        (
                            -- Base engagement score
                            (view_count * 1.0 + like_count * 5.0 + exchange_count * 10.0 + comment_count * 3.0)
                            -- Time decay factor: newer cards get higher scores
                            / POWER(GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0, 1) + 2, 1.5)
                        ),
                        0
                    )
            )
            WHERE is_deleted = FALSE AND privacy_level = 'public'
            "#
        )
        .execute(&self.pool)
        .await?;

        // If Redis is available, cache the top rankings for each time range
        if let Some(ref redis) = self.redis {
            let mut redis_conn = redis.clone();
            
            // Cache daily rankings
            self.cache_rankings(&mut redis_conn, TimeRange::Day).await?;
            
            // Cache weekly rankings
            self.cache_rankings(&mut redis_conn, TimeRange::Week).await?;
            
            // Cache monthly rankings
            self.cache_rankings(&mut redis_conn, TimeRange::Month).await?;
        }

        Ok(())
    }

    /// Cache hot rankings for a specific time range in Redis
    async fn cache_rankings(
        &self,
        redis_conn: &mut redis::aio::ConnectionManager,
        time_range: TimeRange,
    ) -> Result<(), AppError> {
        let (interval, ttl) = match time_range {
            TimeRange::Day => ("1 day", HOT_RANKINGS_TTL_DAY),
            TimeRange::Week => ("7 days", HOT_RANKINGS_TTL_WEEK),
            TimeRange::Month => ("30 days", HOT_RANKINGS_TTL_MONTH),
        };

        // Get top 100 cards for this time range
        let card_ids: Vec<(Uuid, f64)> = sqlx::query_as(
            &format!(
                r#"
                SELECT id, hot_score
                FROM cards
                WHERE is_deleted = FALSE 
                  AND privacy_level = 'public'
                  AND created_at > NOW() - INTERVAL '{}'
                ORDER BY hot_score DESC
                LIMIT 100
                "#,
                interval
            )
        )
        .fetch_all(&self.pool)
        .await?;

        let key = format!("{}{}", HOT_RANKINGS_KEY_PREFIX, time_range.as_str());
        
        // Clear existing rankings
        let _: () = redis_conn.del(&key).await.map_err(|e| {
            AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
        })?;

        // Add card IDs with their scores to a sorted set
        if !card_ids.is_empty() {
            let items: Vec<(f64, String)> = card_ids
                .iter()
                .map(|(id, score)| (*score, id.to_string()))
                .collect();
            
            let _: () = redis_conn.zadd_multiple(&key, &items).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
            })?;
            
            // Set TTL
            let _: () = redis_conn.expire(&key, ttl as i64).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
            })?;
        }

        Ok(())
    }

    /// Get hot rankings for a specific time range
    /// Requirements: 4.9
    pub async fn get_hot_rankings(
        &self,
        time_range: TimeRange,
        limit: usize,
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        let limit = limit.min(100); // Cap at 100 results
        
        // Try to get from Redis cache first
        if let Some(ref redis) = self.redis {
            let mut redis_conn = redis.clone();
            let key = format!("{}{}", HOT_RANKINGS_KEY_PREFIX, time_range.as_str());
            
            // Check if cache exists
            let exists: bool = redis_conn.exists(&key).await.map_err(|e| {
                AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
            })?;
            
            if exists {
                // Get card IDs from sorted set (highest scores first)
                let card_id_strings: Vec<String> = redis_conn
                    .zrevrange(&key, 0, (limit - 1) as isize)
                    .await
                    .map_err(|e| {
                        AppError::Internal(anyhow::anyhow!("Redis error: {}", e))
                    })?;
                
                if !card_id_strings.is_empty() {
                    // Parse UUIDs
                    let card_ids: Vec<Uuid> = card_id_strings
                        .iter()
                        .filter_map(|s| Uuid::parse_str(s).ok())
                        .collect();
                    
                    // Fetch cards from database
                    return self.fetch_cards_by_ids(&card_ids, viewer_id).await;
                }
            }
        }

        // Fallback to database query if Redis is not available or cache miss
        self.get_hot_rankings_from_db(time_range, limit, viewer_id).await
    }

    /// Get hot rankings directly from database
    async fn get_hot_rankings_from_db(
        &self,
        time_range: TimeRange,
        limit: usize,
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        let interval = match time_range {
            TimeRange::Day => "1 day",
            TimeRange::Week => "7 days",
            TimeRange::Month => "30 days",
        };

        let card_rows: Vec<CardRow> = sqlx::query_as(
            &format!(
                r#"
                SELECT 
                    id, creator_id, card_type, title, description, media, location,
                    emotion_tags, interest_tags, privacy_level, base_price,
                    like_count, comment_count, exchange_count, view_count,
                    hot_score, is_deleted, created_at, updated_at
                FROM cards
                WHERE is_deleted = FALSE 
                  AND privacy_level = 'public'
                  AND created_at > NOW() - INTERVAL '{}'
                ORDER BY hot_score DESC
                LIMIT $1
                "#,
                interval
            )
        )
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;

        self.convert_card_rows_to_life_cards(card_rows, viewer_id).await
    }

    /// Fetch cards by their IDs, preserving order
    async fn fetch_cards_by_ids(
        &self,
        card_ids: &[Uuid],
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        if card_ids.is_empty() {
            return Ok(vec![]);
        }

        // Fetch all cards in one query
        let card_rows: Vec<CardRow> = sqlx::query_as(
            r#"
            SELECT 
                id, creator_id, card_type, title, description, media, location,
                emotion_tags, interest_tags, privacy_level, base_price,
                like_count, comment_count, exchange_count, view_count,
                hot_score, is_deleted, created_at, updated_at
            FROM cards
            WHERE id = ANY($1) AND is_deleted = FALSE
            "#
        )
        .bind(card_ids)
        .fetch_all(&self.pool)
        .await?;

        // Create a map for quick lookup
        let card_map: std::collections::HashMap<Uuid, CardRow> = card_rows
            .into_iter()
            .map(|row| (row.id, row))
            .collect();

        // Preserve the original order from card_ids
        let ordered_rows: Vec<CardRow> = card_ids
            .iter()
            .filter_map(|id| card_map.get(id).cloned())
            .collect();

        self.convert_card_rows_to_life_cards(ordered_rows, viewer_id).await
    }

    /// Convert CardRow list to LifeCard list with creator info and like/collection status
    async fn convert_card_rows_to_life_cards(
        &self,
        card_rows: Vec<CardRow>,
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        let mut cards = Vec::with_capacity(card_rows.len());
        
        for row in card_rows {
            // Get creator summary
            let creator: Option<UserSummary> = sqlx::query_as(
                r#"
                SELECT id, nickname, avatar_url as avatar, level
                FROM users WHERE id = $1
                "#
            )
            .bind(&row.creator_id)
            .fetch_optional(&self.pool)
            .await?;

            let (is_liked, is_collected) = if let Some(uid) = viewer_id {
                // Check if viewer has liked this card
                let liked = sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM card_likes WHERE card_id = $1 AND user_id = $2"
                )
                .bind(&row.id)
                .bind(uid)
                .fetch_one(&self.pool)
                .await? > 0;

                // Check if viewer has collected this card
                let collected = sqlx::query_scalar::<_, i64>(
                    "SELECT COUNT(*) FROM card_collections WHERE card_id = $1 AND user_id = $2"
                )
                .bind(&row.id)
                .bind(uid)
                .fetch_one(&self.pool)
                .await? > 0;

                (liked, collected)
            } else {
                (false, false)
            };

            cards.push(row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(cards)
    }

    /// Get random cards for exploration mode (serendipitous discovery)
    /// Returns random public cards, optionally excluding specified card IDs
    /// Requirements: 4.10
    pub async fn get_random_cards(
        &self,
        count: usize,
        exclude_ids: &[Uuid],
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        let count = count.min(50); // Cap at 50 results for performance

        let card_rows: Vec<CardRow> = if exclude_ids.is_empty() {
            // No exclusions - simple random query
            sqlx::query_as(
                r#"
                SELECT 
                    id, creator_id, card_type, title, description, media, location,
                    emotion_tags, interest_tags, privacy_level, base_price,
                    like_count, comment_count, exchange_count, view_count,
                    hot_score, is_deleted, created_at, updated_at
                FROM cards
                WHERE is_deleted = FALSE 
                  AND privacy_level = 'public'
                ORDER BY RANDOM()
                LIMIT $1
                "#
            )
            .bind(count as i64)
            .fetch_all(&self.pool)
            .await?
        } else {
            // Exclude specified card IDs
            sqlx::query_as(
                r#"
                SELECT 
                    id, creator_id, card_type, title, description, media, location,
                    emotion_tags, interest_tags, privacy_level, base_price,
                    like_count, comment_count, exchange_count, view_count,
                    hot_score, is_deleted, created_at, updated_at
                FROM cards
                WHERE is_deleted = FALSE 
                  AND privacy_level = 'public'
                  AND id != ALL($1)
                ORDER BY RANDOM()
                LIMIT $2
                "#
            )
            .bind(exclude_ids)
            .bind(count as i64)
            .fetch_all(&self.pool)
            .await?
        };

        self.convert_card_rows_to_life_cards(card_rows, viewer_id).await
    }
}
