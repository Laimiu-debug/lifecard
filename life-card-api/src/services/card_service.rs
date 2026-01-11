//! Card service for handling card-related operations
//!
//! Requirements: 3.2, 3.7, 3.8, 3.9, 3.10, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8

use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::models::card::{
    CardCreateData, CardRow, CardSearchResult, CardUpdateData, LifeCard, 
    LocationFilter, PrivacyLevel, SearchQuery,
};
use crate::models::common::Pagination;
use crate::models::user::{CoinReason, UserSummary};

/// Card service for handling card-related operations
pub struct CardService {
    pool: PgPool,
    config: Config,
}

impl CardService {
    /// Create a new CardService instance
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self { pool, config }
    }

    /// Create a new card
    /// Requirements: 3.2, 3.8, 3.9, 3.10
    pub async fn create_card(
        &self,
        user_id: &Uuid,
        data: CardCreateData,
    ) -> Result<LifeCard, AppError> {
        // Validate the card data
        data.validate().map_err(AppError::Validation)?;

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

        let card_id = Uuid::new_v4();
        let privacy_level = data.privacy_level.clone().unwrap_or_default();
        let media_json = serde_json::to_value(data.media.clone().unwrap_or_default())
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize media: {}", e)))?;
        let location_json = data.location.as_ref()
            .map(|l| serde_json::to_value(l))
            .transpose()
            .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to serialize location: {}", e)))?;
        let emotion_tags = data.emotion_tags.clone().unwrap_or_default();
        let interest_tags = data.interest_tags.clone().unwrap_or_default();

        // Calculate base price (default 10)
        let base_price = self.config.default_card_price;

        // Insert the card
        let card_row = sqlx::query_as::<_, CardRow>(
            r#"
            INSERT INTO cards (
                id, creator_id, card_type, title, description,
                media, location, emotion_tags, interest_tags,
                privacy_level, base_price
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
            "#,
        )
        .bind(card_id)
        .bind(user_id)
        .bind(&data.card_type)
        .bind(&data.title)
        .bind(&data.description)
        .bind(&media_json)
        .bind(&location_json)
        .bind(&emotion_tags)
        .bind(&interest_tags)
        .bind(&privacy_level)
        .bind(base_price)
        .fetch_one(&self.pool)
        .await?;

        // Update user's card count
        sqlx::query(
            "UPDATE users SET card_count = card_count + 1 WHERE id = $1"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        // Award coins for card creation based on completeness
        let coin_reward = data.calculate_creation_reward();
        self.award_coins(user_id, coin_reward, CoinReason::CardCreated, Some(card_id)).await?;

        // Get creator info
        let creator = self.get_user_summary(user_id).await?;

        Ok(card_row.to_life_card(creator, false, false))
    }


    /// Get a card by ID with privacy enforcement
    /// Requirements: 3.7, 4.6, 4.7
    pub async fn get_card(
        &self,
        card_id: &Uuid,
        viewer_id: Option<&Uuid>,
    ) -> Result<Option<LifeCard>, AppError> {
        // Fetch the card
        let card_row = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT * FROM cards
            WHERE id = $1 AND is_deleted = false
            "#,
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?;

        let card_row = match card_row {
            Some(row) => row,
            None => return Ok(None),
        };

        // Check privacy enforcement
        let can_view = self.check_card_visibility(&card_row, viewer_id).await?;
        if !can_view {
            return Err(AppError::Forbidden);
        }

        // Get creator info
        let creator = self.get_user_summary(&card_row.creator_id).await?;

        // Check if viewer has liked/collected this card
        let (is_liked, is_collected) = if let Some(vid) = viewer_id {
            let liked = self.has_liked_card(vid, card_id).await?;
            let collected = self.has_collected_card(vid, card_id).await?;
            (liked, collected)
        } else {
            (false, false)
        };

        // Increment view count
        sqlx::query("UPDATE cards SET view_count = view_count + 1 WHERE id = $1")
            .bind(card_id)
            .execute(&self.pool)
            .await?;

        Ok(Some(card_row.to_life_card(creator, is_liked, is_collected)))
    }

    /// Check if a viewer can see a card based on privacy settings
    /// Requirements: 3.7, 4.7
    /// 
    /// Privacy rules:
    /// - Public: Anyone can view
    /// - FriendsOnly: Only the creator or users who follow the creator can view
    /// - ExchangeOnly: Only the creator or users who have collected the card through exchange can view
    pub async fn check_card_visibility(
        &self,
        card: &CardRow,
        viewer_id: Option<&Uuid>,
    ) -> Result<bool, AppError> {
        match card.privacy_level {
            PrivacyLevel::Public => Ok(true),
            PrivacyLevel::FriendsOnly => {
                // Check if viewer is the creator or follows the creator
                match viewer_id {
                    Some(vid) if *vid == card.creator_id => Ok(true),
                    Some(vid) => self.is_following(vid, &card.creator_id).await,
                    None => Ok(false),
                }
            }
            PrivacyLevel::ExchangeOnly => {
                // Check if viewer is the creator or has exchanged for this card
                match viewer_id {
                    Some(vid) if *vid == card.creator_id => Ok(true),
                    Some(vid) => self.has_collected_card(vid, &card.id).await,
                    None => Ok(false),
                }
            }
        }
    }

    /// Check if a viewer can see a card by card ID
    /// Requirements: 3.7, 4.7
    pub async fn can_view_card(
        &self,
        card_id: &Uuid,
        viewer_id: Option<&Uuid>,
    ) -> Result<bool, AppError> {
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?;

        match card_row {
            Some(card) => self.check_card_visibility(&card, viewer_id).await,
            None => Ok(false), // Card doesn't exist
        }
    }

    /// Get the privacy level of a card
    /// Requirements: 3.7
    pub async fn get_card_privacy_level(&self, card_id: &Uuid) -> Result<Option<PrivacyLevel>, AppError> {
        let privacy = sqlx::query_scalar::<_, PrivacyLevel>(
            "SELECT privacy_level FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(privacy)
    }

    /// Update the privacy level of a card
    /// Requirements: 3.7
    pub async fn update_privacy_level(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
        privacy_level: PrivacyLevel,
    ) -> Result<PrivacyLevel, AppError> {
        // Verify ownership
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        if card_row.creator_id != *user_id {
            return Err(AppError::Forbidden);
        }

        // Update privacy level
        let updated_privacy = sqlx::query_scalar::<_, PrivacyLevel>(
            r#"
            UPDATE cards 
            SET privacy_level = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING privacy_level
            "#,
        )
        .bind(&privacy_level)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(updated_privacy)
    }

    /// Get all public cards (for discovery)
    /// Requirements: 4.7
    pub async fn get_public_cards(
        &self,
        viewer_id: Option<&Uuid>,
        limit: i64,
    ) -> Result<Vec<LifeCard>, AppError> {
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT * FROM cards
            WHERE is_deleted = false
            AND privacy_level = 'public'
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let (is_liked, is_collected) = if let Some(vid) = viewer_id {
                let liked = self.has_liked_card(vid, &card_row.id).await?;
                let collected = self.has_collected_card(vid, &card_row.id).await?;
                (liked, collected)
            } else {
                (false, false)
            };
            result.push(card_row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(result)
    }

    /// Get cards visible to a specific viewer (respects privacy settings)
    /// Requirements: 3.7, 4.7
    pub async fn get_visible_cards(
        &self,
        viewer_id: &Uuid,
        limit: i64,
    ) -> Result<Vec<LifeCard>, AppError> {
        // Get cards that are:
        // 1. Public
        // 2. FriendsOnly where viewer follows the creator
        // 3. ExchangeOnly where viewer has collected the card
        // 4. Created by the viewer themselves
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT DISTINCT c.* FROM cards c
            LEFT JOIN follows f ON f.followee_id = c.creator_id AND f.follower_id = $1
            LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.user_id = $1
            WHERE c.is_deleted = false
            AND (
                c.privacy_level = 'public'
                OR c.creator_id = $1
                OR (c.privacy_level = 'friends_only' AND f.id IS NOT NULL)
                OR (c.privacy_level = 'exchange_only' AND cc.id IS NOT NULL)
            )
            ORDER BY c.created_at DESC
            LIMIT $2
            "#,
        )
        .bind(viewer_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(viewer_id, &card_row.id).await?;
            let is_collected = self.has_collected_card(viewer_id, &card_row.id).await?;
            result.push(card_row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(result)
    }

    /// Get cards from users that the viewer follows (for feed)
    /// Requirements: 4.7, 8.8
    pub async fn get_following_cards(
        &self,
        viewer_id: &Uuid,
        limit: i64,
    ) -> Result<Vec<LifeCard>, AppError> {
        // Get cards from followed users that are visible to the viewer
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT c.* FROM cards c
            INNER JOIN follows f ON f.followee_id = c.creator_id AND f.follower_id = $1
            WHERE c.is_deleted = false
            AND (
                c.privacy_level = 'public'
                OR c.privacy_level = 'friends_only'
            )
            ORDER BY c.created_at DESC
            LIMIT $2
            "#,
        )
        .bind(viewer_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(viewer_id, &card_row.id).await?;
            let is_collected = self.has_collected_card(viewer_id, &card_row.id).await?;
            result.push(card_row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(result)
    }

    /// Get personalized feed with cursor-based pagination
    /// Requirements: 4.1, 4.8
    /// 
    /// Returns cards ordered by creation time, with cursor pointing to the last item's timestamp.
    /// The cursor is the ISO 8601 timestamp of the last card in the previous page.
    pub async fn get_feed_with_cursor(
        &self,
        viewer_id: &Uuid,
        cursor: Option<&str>,
        limit: i64,
    ) -> Result<crate::models::card::CardFeedResult, AppError> {
        use chrono::DateTime;

        // Parse cursor (ISO 8601 timestamp)
        let cursor_time = cursor
            .map(|c| DateTime::parse_from_rfc3339(c))
            .transpose()
            .map_err(|_| AppError::Validation("Invalid cursor format".to_string()))?
            .map(|dt| dt.with_timezone(&chrono::Utc));

        // Fetch one more than limit to check if there are more results
        let fetch_limit = limit + 1;

        let card_rows = if let Some(cursor_dt) = cursor_time {
            // Get cards created before the cursor timestamp
            sqlx::query_as::<_, CardRow>(
                r#"
                SELECT DISTINCT c.* FROM cards c
                LEFT JOIN follows f ON f.followee_id = c.creator_id AND f.follower_id = $1
                LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.user_id = $1
                WHERE c.is_deleted = false
                AND c.created_at < $2
                AND (
                    c.privacy_level = 'public'
                    OR c.creator_id = $1
                    OR (c.privacy_level = 'friends_only' AND f.id IS NOT NULL)
                    OR (c.privacy_level = 'exchange_only' AND cc.id IS NOT NULL)
                )
                ORDER BY c.created_at DESC
                LIMIT $3
                "#,
            )
            .bind(viewer_id)
            .bind(cursor_dt)
            .bind(fetch_limit)
            .fetch_all(&self.pool)
            .await?
        } else {
            // First page - no cursor
            sqlx::query_as::<_, CardRow>(
                r#"
                SELECT DISTINCT c.* FROM cards c
                LEFT JOIN follows f ON f.followee_id = c.creator_id AND f.follower_id = $1
                LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.user_id = $1
                WHERE c.is_deleted = false
                AND (
                    c.privacy_level = 'public'
                    OR c.creator_id = $1
                    OR (c.privacy_level = 'friends_only' AND f.id IS NOT NULL)
                    OR (c.privacy_level = 'exchange_only' AND cc.id IS NOT NULL)
                )
                ORDER BY c.created_at DESC
                LIMIT $2
                "#,
            )
            .bind(viewer_id)
            .bind(fetch_limit)
            .fetch_all(&self.pool)
            .await?
        };

        // Check if there are more results
        let has_more = card_rows.len() as i64 > limit;
        
        // Take only the requested number of items
        let card_rows: Vec<_> = card_rows.into_iter().take(limit as usize).collect();

        // Convert to LifeCard
        let mut cards = Vec::new();
        for card_row in &card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(viewer_id, &card_row.id).await?;
            let is_collected = self.has_collected_card(viewer_id, &card_row.id).await?;
            cards.push(card_row.to_life_card(creator, is_liked, is_collected));
        }

        // Generate next cursor from the last card's timestamp
        let next_cursor = if has_more {
            cards.last().map(|c| c.created_at.to_rfc3339())
        } else {
            None
        };

        Ok(crate::models::card::CardFeedResult {
            cards,
            has_more,
            next_cursor,
        })
    }

    /// Get user's created cards with pagination
    /// Requirements: 7.1, 4.8
    pub async fn get_user_cards_paginated(
        &self,
        user_id: &Uuid,
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        // Count total cards
        let total_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE creator_id = $1 AND is_deleted = false"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Fetch cards with pagination
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT * FROM cards
            WHERE creator_id = $1 AND is_deleted = false
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        // Convert to LifeCard
        let mut cards = Vec::new();
        for card_row in card_rows {
            // Check visibility for viewer
            if self.check_card_visibility(&card_row, viewer_id).await? {
                let creator = self.get_user_summary(&card_row.creator_id).await?;
                let (is_liked, is_collected) = if let Some(vid) = viewer_id {
                    let liked = self.has_liked_card(vid, &card_row.id).await?;
                    let collected = self.has_collected_card(vid, &card_row.id).await?;
                    (liked, collected)
                } else {
                    (false, false)
                };
                cards.push(card_row.to_life_card(creator, is_liked, is_collected));
            }
        }

        Ok(CardSearchResult { cards, total_count })
    }

    /// Get user's collected cards with pagination
    /// Requirements: 7.2, 4.8
    pub async fn get_collected_cards_paginated(
        &self,
        user_id: &Uuid,
        pagination: &Pagination,
    ) -> Result<CardSearchResult, AppError> {
        // Count total collected cards
        let total_count = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM card_collections cc
            INNER JOIN cards c ON c.id = cc.card_id
            WHERE cc.user_id = $1 AND c.is_deleted = false
            "#
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Fetch collected cards with pagination
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT c.* FROM cards c
            INNER JOIN card_collections cc ON cc.card_id = c.id
            WHERE cc.user_id = $1 AND c.is_deleted = false
            ORDER BY cc.collected_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        // Convert to LifeCard
        let mut cards = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(user_id, &card_row.id).await?;
            cards.push(card_row.to_life_card(creator, is_liked, true)); // is_collected is always true
        }

        Ok(CardSearchResult { cards, total_count })
    }

    /// Check if a user is following another user
    async fn is_following(&self, follower_id: &Uuid, followee_id: &Uuid) -> Result<bool, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND followee_id = $2"
        )
        .bind(follower_id)
        .bind(followee_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    /// Check if a user has liked a card
    async fn has_liked_card(&self, user_id: &Uuid, card_id: &Uuid) -> Result<bool, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_likes WHERE user_id = $1 AND card_id = $2"
        )
        .bind(user_id)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    /// Check if a user has collected a card (through exchange)
    async fn has_collected_card(&self, user_id: &Uuid, card_id: &Uuid) -> Result<bool, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_collections WHERE user_id = $1 AND card_id = $2"
        )
        .bind(user_id)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    /// Get user summary for embedding in card responses
    async fn get_user_summary(&self, user_id: &Uuid) -> Result<Option<UserSummary>, AppError> {
        let summary = sqlx::query_as::<_, UserSummary>(
            r#"
            SELECT id, nickname, avatar_url as avatar, level
            FROM users WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(summary)
    }

    /// Award coins to a user
    async fn award_coins(
        &self,
        user_id: &Uuid,
        amount: i32,
        reason: CoinReason,
        reference_id: Option<Uuid>,
    ) -> Result<i32, AppError> {
        if amount <= 0 {
            return Ok(0);
        }

        // Update balance and get new balance
        let new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(amount)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Record transaction
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(amount)
        .bind(reason.to_string())
        .bind(reference_id)
        .bind(new_balance)
        .execute(&self.pool)
        .await?;

        Ok(new_balance)
    }


    /// Update an existing card
    /// Requirements: 7.5, 9.2
    pub async fn update_card(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
        data: CardUpdateData,
    ) -> Result<LifeCard, AppError> {
        // Validate the update data
        data.validate().map_err(AppError::Validation)?;

        // Fetch the card and verify ownership
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        // Verify ownership
        if card_row.creator_id != *user_id {
            return Err(AppError::Forbidden);
        }

        // Build update query dynamically
        let updated_row = sqlx::query_as::<_, CardRow>(
            r#"
            UPDATE cards SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                emotion_tags = COALESCE($3, emotion_tags),
                interest_tags = COALESCE($4, interest_tags),
                privacy_level = COALESCE($5, privacy_level),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 AND is_deleted = false
            RETURNING *
            "#,
        )
        .bind(&data.title)
        .bind(&data.description)
        .bind(&data.emotion_tags)
        .bind(&data.interest_tags)
        .bind(&data.privacy_level)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        // Get creator info
        let creator = self.get_user_summary(user_id).await?;

        Ok(updated_row.to_life_card(creator, false, false))
    }

    /// Delete a card (soft delete)
    /// Requirements: 7.5, 7.6
    pub async fn delete_card(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<(), AppError> {
        // Fetch the card and verify ownership
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        // Verify ownership
        if card_row.creator_id != *user_id {
            return Err(AppError::Forbidden);
        }

        // Check if card has been exchanged to others
        // Requirement 7.6: Prevent deletion of cards that have been exchanged
        let exchange_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_collections WHERE card_id = $1"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if exchange_count > 0 {
            return Err(AppError::BusinessLogic(
                "Cannot delete a card that has been exchanged to other users".to_string()
            ));
        }

        // Soft delete the card
        sqlx::query(
            "UPDATE cards SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1"
        )
        .bind(card_id)
        .execute(&self.pool)
        .await?;

        // Update user's card count
        sqlx::query(
            "UPDATE users SET card_count = GREATEST(card_count - 1, 0) WHERE id = $1"
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Check if a card exists and is not deleted
    pub async fn card_exists(&self, card_id: &Uuid) -> Result<bool, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }

    /// Get the creator ID of a card
    pub async fn get_card_creator(&self, card_id: &Uuid) -> Result<Option<Uuid>, AppError> {
        let creator_id = sqlx::query_scalar::<_, Uuid>(
            "SELECT creator_id FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(creator_id)
    }

    /// Search cards with keyword, type, tag, and location filtering
    /// Requirements: 4.2, 4.3, 4.4, 4.5
    /// 
    /// Supports:
    /// - Full-text search on title and description using PostgreSQL tsvector
    /// - Card type filtering
    /// - Interest tag filtering
    /// - Location-based filtering with geographic distance calculation
    /// - Creator filtering
    pub async fn search_cards(
        &self,
        query: &SearchQuery,
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        // Build dynamic WHERE clauses
        let mut conditions = vec!["c.is_deleted = false".to_string()];
        let mut param_index = 1;

        // Keyword search using full-text search
        let keyword_param_idx = if query.keyword.is_some() {
            conditions.push(format!(
                "to_tsvector('simple', c.title || ' ' || c.description) @@ plainto_tsquery('simple', ${})",
                param_index
            ));
            let idx = param_index;
            param_index += 1;
            Some(idx)
        } else {
            None
        };

        // Card type filter
        let card_type_param_idx = if query.card_type.is_some() {
            conditions.push(format!("c.card_type = ${}", param_index));
            let idx = param_index;
            param_index += 1;
            Some(idx)
        } else {
            None
        };

        // Interest tags filter (cards that have ANY of the specified tags)
        let interest_tags_param_idx = if query.interest_tags.as_ref().map_or(false, |t| !t.is_empty()) {
            conditions.push(format!("c.interest_tags && ${}", param_index));
            let idx = param_index;
            param_index += 1;
            Some(idx)
        } else {
            None
        };

        // Creator filter
        let creator_param_idx = if query.creator_id.is_some() {
            conditions.push(format!("c.creator_id = ${}", param_index));
            let idx = param_index;
            param_index += 1;
            Some(idx)
        } else {
            None
        };

        // Location filter using Haversine formula for distance calculation
        let location_param_indices = if let Some(ref loc) = query.location {
            if loc.is_valid() {
                // Haversine formula for distance in km
                // 6371 is Earth's radius in km
                conditions.push(format!(
                    r#"c.location IS NOT NULL AND (
                        6371 * acos(
                            cos(radians(${lat})) * cos(radians((c.location->>'latitude')::float)) *
                            cos(radians((c.location->>'longitude')::float) - radians(${lon})) +
                            sin(radians(${lat})) * sin(radians((c.location->>'latitude')::float))
                        )
                    ) <= ${radius}"#,
                    lat = param_index,
                    lon = param_index + 1,
                    radius = param_index + 2
                ));
                let indices = (param_index, param_index + 1, param_index + 2);
                param_index += 3;
                Some(indices)
            } else {
                None
            }
        } else {
            None
        };

        // Privacy filter - only show public cards for search (unless viewer is creator)
        let viewer_param_idx = if let Some(_) = viewer_id {
            conditions.push(format!(
                "(c.privacy_level = 'public' OR c.creator_id = ${})",
                param_index
            ));
            let idx = param_index;
            param_index += 1;
            Some(idx)
        } else {
            conditions.push("c.privacy_level = 'public'".to_string());
            None
        };

        let where_clause = conditions.join(" AND ");

        // Build the count query
        let count_query = format!(
            "SELECT COUNT(*) FROM cards c WHERE {}",
            where_clause
        );

        // Build the main query with pagination
        let limit_param_idx = param_index;
        let offset_param_idx = param_index + 1;

        let main_query = format!(
            r#"
            SELECT c.* FROM cards c
            WHERE {}
            ORDER BY c.created_at DESC
            LIMIT ${} OFFSET ${}
            "#,
            where_clause,
            limit_param_idx,
            offset_param_idx
        );

        // Execute count query
        let mut count_query_builder = sqlx::query_scalar::<_, i64>(&count_query);
        
        // Bind parameters for count query
        if let Some(_) = keyword_param_idx {
            count_query_builder = count_query_builder.bind(query.keyword.as_ref().unwrap());
        }
        if let Some(_) = card_type_param_idx {
            count_query_builder = count_query_builder.bind(query.card_type.as_ref().unwrap());
        }
        if let Some(_) = interest_tags_param_idx {
            count_query_builder = count_query_builder.bind(query.interest_tags.as_ref().unwrap());
        }
        if let Some(_) = creator_param_idx {
            count_query_builder = count_query_builder.bind(query.creator_id.as_ref().unwrap());
        }
        if let Some(_) = location_param_indices {
            let loc = query.location.as_ref().unwrap();
            count_query_builder = count_query_builder
                .bind(loc.latitude)
                .bind(loc.longitude)
                .bind(loc.radius_km);
        }
        if let Some(_) = viewer_param_idx {
            count_query_builder = count_query_builder.bind(viewer_id.unwrap());
        }

        let total_count = count_query_builder.fetch_one(&self.pool).await?;

        // Execute main query
        let mut main_query_builder = sqlx::query_as::<_, CardRow>(&main_query);

        // Bind parameters for main query
        if let Some(_) = keyword_param_idx {
            main_query_builder = main_query_builder.bind(query.keyword.as_ref().unwrap());
        }
        if let Some(_) = card_type_param_idx {
            main_query_builder = main_query_builder.bind(query.card_type.as_ref().unwrap());
        }
        if let Some(_) = interest_tags_param_idx {
            main_query_builder = main_query_builder.bind(query.interest_tags.as_ref().unwrap());
        }
        if let Some(_) = creator_param_idx {
            main_query_builder = main_query_builder.bind(query.creator_id.as_ref().unwrap());
        }
        if let Some(_) = location_param_indices {
            let loc = query.location.as_ref().unwrap();
            main_query_builder = main_query_builder
                .bind(loc.latitude)
                .bind(loc.longitude)
                .bind(loc.radius_km);
        }
        if let Some(_) = viewer_param_idx {
            main_query_builder = main_query_builder.bind(viewer_id.unwrap());
        }

        // Bind pagination parameters
        main_query_builder = main_query_builder
            .bind(pagination.limit())
            .bind(pagination.offset());

        let card_rows = main_query_builder.fetch_all(&self.pool).await?;

        // Convert to LifeCard with creator info
        let mut cards = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let (is_liked, is_collected) = if let Some(vid) = viewer_id {
                let liked = self.has_liked_card(vid, &card_row.id).await?;
                let collected = self.has_collected_card(vid, &card_row.id).await?;
                (liked, collected)
            } else {
                (false, false)
            };
            cards.push(card_row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(CardSearchResult { cards, total_count })
    }

    /// Search cards by keyword only (simplified search)
    /// Requirements: 4.2
    pub async fn search_by_keyword(
        &self,
        keyword: &str,
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        let query = SearchQuery {
            keyword: Some(keyword.to_string()),
            ..Default::default()
        };
        self.search_cards(&query, pagination, viewer_id).await
    }

    /// Search cards by card type only
    /// Requirements: 4.3
    pub async fn search_by_card_type(
        &self,
        card_type: &crate::models::card::CardType,
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        let query = SearchQuery {
            card_type: Some(card_type.clone()),
            ..Default::default()
        };
        self.search_cards(&query, pagination, viewer_id).await
    }

    /// Search cards by interest category/tags
    /// Requirements: 4.4
    pub async fn search_by_interest_tags(
        &self,
        tags: &[String],
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        let query = SearchQuery {
            interest_tags: Some(tags.to_vec()),
            ..Default::default()
        };
        self.search_cards(&query, pagination, viewer_id).await
    }

    /// Search cards by location (within radius)
    /// Requirements: 4.5
    pub async fn search_by_location(
        &self,
        location: &LocationFilter,
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        if !location.is_valid() {
            return Err(AppError::Validation("Invalid location filter".to_string()));
        }
        let query = SearchQuery {
            location: Some(location.clone()),
            ..Default::default()
        };
        self.search_cards(&query, pagination, viewer_id).await
    }

    /// Get paginated list of all public cards
    /// Requirements: 4.8
    pub async fn get_cards_paginated(
        &self,
        pagination: &Pagination,
        viewer_id: Option<&Uuid>,
    ) -> Result<CardSearchResult, AppError> {
        let query = SearchQuery::default();
        self.search_cards(&query, pagination, viewer_id).await
    }

    /// Filter cards by emotion tags
    /// Requirements: 3.5
    /// Returns cards that have ANY of the specified emotion tags
    pub async fn filter_by_emotion_tags(
        &self,
        tags: &[String],
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        if tags.is_empty() {
            return Ok(Vec::new());
        }

        // Query cards that have any of the specified emotion tags
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT * FROM cards
            WHERE is_deleted = false
            AND emotion_tags && $1
            ORDER BY created_at DESC
            LIMIT 100
            "#,
        )
        .bind(tags)
        .fetch_all(&self.pool)
        .await?;

        // Filter by privacy and convert to LifeCard
        let mut result = Vec::new();
        for card_row in card_rows {
            if self.check_card_visibility(&card_row, viewer_id).await? {
                let creator = self.get_user_summary(&card_row.creator_id).await?;
                let (is_liked, is_collected) = if let Some(vid) = viewer_id {
                    let liked = self.has_liked_card(vid, &card_row.id).await?;
                    let collected = self.has_collected_card(vid, &card_row.id).await?;
                    (liked, collected)
                } else {
                    (false, false)
                };
                result.push(card_row.to_life_card(creator, is_liked, is_collected));
            }
        }

        Ok(result)
    }

    /// Filter cards by interest tags
    /// Requirements: 3.6
    /// Returns cards that have ANY of the specified interest tags
    pub async fn filter_by_interest_tags(
        &self,
        tags: &[String],
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        if tags.is_empty() {
            return Ok(Vec::new());
        }

        // Query cards that have any of the specified interest tags
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT * FROM cards
            WHERE is_deleted = false
            AND interest_tags && $1
            ORDER BY created_at DESC
            LIMIT 100
            "#,
        )
        .bind(tags)
        .fetch_all(&self.pool)
        .await?;

        // Filter by privacy and convert to LifeCard
        let mut result = Vec::new();
        for card_row in card_rows {
            if self.check_card_visibility(&card_row, viewer_id).await? {
                let creator = self.get_user_summary(&card_row.creator_id).await?;
                let (is_liked, is_collected) = if let Some(vid) = viewer_id {
                    let liked = self.has_liked_card(vid, &card_row.id).await?;
                    let collected = self.has_collected_card(vid, &card_row.id).await?;
                    (liked, collected)
                } else {
                    (false, false)
                };
                result.push(card_row.to_life_card(creator, is_liked, is_collected));
            }
        }

        Ok(result)
    }

    /// Filter cards by both emotion and interest tags
    /// Requirements: 3.5, 3.6
    /// Returns cards that have ANY of the specified emotion tags AND ANY of the specified interest tags
    pub async fn filter_by_tags(
        &self,
        emotion_tags: Option<&[String]>,
        interest_tags: Option<&[String]>,
        viewer_id: Option<&Uuid>,
    ) -> Result<Vec<LifeCard>, AppError> {
        // Build dynamic query based on provided tags
        let has_emotion_filter = emotion_tags.map_or(false, |t| !t.is_empty());
        let has_interest_filter = interest_tags.map_or(false, |t| !t.is_empty());

        if !has_emotion_filter && !has_interest_filter {
            return Ok(Vec::new());
        }

        let card_rows = if has_emotion_filter && has_interest_filter {
            // Both filters
            sqlx::query_as::<_, CardRow>(
                r#"
                SELECT * FROM cards
                WHERE is_deleted = false
                AND emotion_tags && $1
                AND interest_tags && $2
                ORDER BY created_at DESC
                LIMIT 100
                "#,
            )
            .bind(emotion_tags.unwrap())
            .bind(interest_tags.unwrap())
            .fetch_all(&self.pool)
            .await?
        } else if has_emotion_filter {
            // Only emotion filter
            sqlx::query_as::<_, CardRow>(
                r#"
                SELECT * FROM cards
                WHERE is_deleted = false
                AND emotion_tags && $1
                ORDER BY created_at DESC
                LIMIT 100
                "#,
            )
            .bind(emotion_tags.unwrap())
            .fetch_all(&self.pool)
            .await?
        } else {
            // Only interest filter
            sqlx::query_as::<_, CardRow>(
                r#"
                SELECT * FROM cards
                WHERE is_deleted = false
                AND interest_tags && $1
                ORDER BY created_at DESC
                LIMIT 100
                "#,
            )
            .bind(interest_tags.unwrap())
            .fetch_all(&self.pool)
            .await?
        };

        // Filter by privacy and convert to LifeCard
        let mut result = Vec::new();
        for card_row in card_rows {
            if self.check_card_visibility(&card_row, viewer_id).await? {
                let creator = self.get_user_summary(&card_row.creator_id).await?;
                let (is_liked, is_collected) = if let Some(vid) = viewer_id {
                    let liked = self.has_liked_card(vid, &card_row.id).await?;
                    let collected = self.has_collected_card(vid, &card_row.id).await?;
                    (liked, collected)
                } else {
                    (false, false)
                };
                result.push(card_row.to_life_card(creator, is_liked, is_collected));
            }
        }

        Ok(result)
    }

    /// Get all emotion tags from a card
    /// Requirements: 3.5
    pub async fn get_card_emotion_tags(&self, card_id: &Uuid) -> Result<Vec<String>, AppError> {
        let tags = sqlx::query_scalar::<_, Vec<String>>(
            "SELECT emotion_tags FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or_default();

        Ok(tags)
    }

    /// Get all interest tags from a card
    /// Requirements: 3.6
    pub async fn get_card_interest_tags(&self, card_id: &Uuid) -> Result<Vec<String>, AppError> {
        let tags = sqlx::query_scalar::<_, Vec<String>>(
            "SELECT interest_tags FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .unwrap_or_default();

        Ok(tags)
    }

    /// Update emotion tags for a card
    /// Requirements: 3.5
    pub async fn update_emotion_tags(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
        tags: Vec<String>,
    ) -> Result<Vec<String>, AppError> {
        // Validate tags
        if tags.len() > 10 {
            return Err(AppError::Validation("Maximum 10 emotion tags allowed".to_string()));
        }
        for tag in &tags {
            if tag.len() > 50 {
                return Err(AppError::Validation("Each emotion tag must be 50 characters or less".to_string()));
            }
        }

        // Verify ownership
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        if card_row.creator_id != *user_id {
            return Err(AppError::Forbidden);
        }

        // Update tags
        let updated_tags = sqlx::query_scalar::<_, Vec<String>>(
            r#"
            UPDATE cards 
            SET emotion_tags = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING emotion_tags
            "#,
        )
        .bind(&tags)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(updated_tags)
    }

    /// Update interest tags for a card
    /// Requirements: 3.6
    pub async fn update_interest_tags(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
        tags: Vec<String>,
    ) -> Result<Vec<String>, AppError> {
        // Validate tags
        if tags.len() > 10 {
            return Err(AppError::Validation("Maximum 10 interest tags allowed".to_string()));
        }
        for tag in &tags {
            if tag.len() > 50 {
                return Err(AppError::Validation("Each interest tag must be 50 characters or less".to_string()));
            }
        }

        // Verify ownership
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        if card_row.creator_id != *user_id {
            return Err(AppError::Forbidden);
        }

        // Update tags
        let updated_tags = sqlx::query_scalar::<_, Vec<String>>(
            r#"
            UPDATE cards 
            SET interest_tags = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING interest_tags
            "#,
        )
        .bind(&tags)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(updated_tags)
    }

    // ========================================================================
    // Social Interactions - Like/Unlike
    // Requirements: 8.1, 8.2
    // ========================================================================

    /// Like a card
    /// Requirements: 8.1
    /// 
    /// When a user likes a card, the system SHALL increment like count and record user's like.
    /// If the user has already liked the card, this operation is idempotent (no error, no change).
    pub async fn like_card(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<i32, AppError> {
        // Verify card exists and is not deleted
        let card_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if card_exists == 0 {
            return Err(AppError::NotFound("Card not found".to_string()));
        }

        // Check if already liked (for idempotence)
        let already_liked = self.has_liked_card(user_id, card_id).await?;
        
        if already_liked {
            // Already liked - return current like count without error (idempotent)
            let like_count = sqlx::query_scalar::<_, i32>(
                "SELECT like_count FROM cards WHERE id = $1"
            )
            .bind(card_id)
            .fetch_one(&self.pool)
            .await?;
            return Ok(like_count);
        }

        // Insert like record (UNIQUE constraint prevents duplicates)
        sqlx::query(
            r#"
            INSERT INTO card_likes (id, card_id, user_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (card_id, user_id) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(card_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        // Increment like count and return new count
        let new_like_count = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE cards 
            SET like_count = like_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING like_count
            "#,
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(new_like_count)
    }

    /// Unlike a card
    /// Requirements: 8.2
    /// 
    /// When a user unlikes a card, the system SHALL decrement like count and remove user's like record.
    /// If the user has not liked the card, this operation is idempotent (no error, no change).
    pub async fn unlike_card(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<i32, AppError> {
        // Verify card exists and is not deleted
        let card_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if card_exists == 0 {
            return Err(AppError::NotFound("Card not found".to_string()));
        }

        // Check if actually liked
        let is_liked = self.has_liked_card(user_id, card_id).await?;
        
        if !is_liked {
            // Not liked - return current like count without error (idempotent)
            let like_count = sqlx::query_scalar::<_, i32>(
                "SELECT like_count FROM cards WHERE id = $1"
            )
            .bind(card_id)
            .fetch_one(&self.pool)
            .await?;
            return Ok(like_count);
        }

        // Delete like record
        let result = sqlx::query(
            "DELETE FROM card_likes WHERE card_id = $1 AND user_id = $2"
        )
        .bind(card_id)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        // Only decrement if we actually deleted a record
        if result.rows_affected() > 0 {
            // Decrement like count (ensure it doesn't go below 0)
            let new_like_count = sqlx::query_scalar::<_, i32>(
                r#"
                UPDATE cards 
                SET like_count = GREATEST(like_count - 1, 0), updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING like_count
                "#,
            )
            .bind(card_id)
            .fetch_one(&self.pool)
            .await?;

            Ok(new_like_count)
        } else {
            // No record was deleted, return current count
            let like_count = sqlx::query_scalar::<_, i32>(
                "SELECT like_count FROM cards WHERE id = $1"
            )
            .bind(card_id)
            .fetch_one(&self.pool)
            .await?;
            Ok(like_count)
        }
    }

    /// Get the like count for a card
    /// Requirements: 8.1, 8.2
    pub async fn get_like_count(&self, card_id: &Uuid) -> Result<i32, AppError> {
        let like_count = sqlx::query_scalar::<_, i32>(
            "SELECT like_count FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        Ok(like_count)
    }

    /// Get the actual count of distinct users who have liked a card
    /// This is used for verification/consistency checks
    /// Requirements: 8.1, 8.2
    pub async fn get_actual_like_count(&self, card_id: &Uuid) -> Result<i64, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(DISTINCT user_id) FROM card_likes WHERE card_id = $1"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    /// Get all users who have liked a card
    /// Requirements: 8.1
    pub async fn get_card_likers(
        &self,
        card_id: &Uuid,
        limit: i64,
    ) -> Result<Vec<UserSummary>, AppError> {
        let likers = sqlx::query_as::<_, UserSummary>(
            r#"
            SELECT u.id, u.nickname, u.avatar_url as avatar, u.level
            FROM users u
            INNER JOIN card_likes cl ON cl.user_id = u.id
            WHERE cl.card_id = $1
            ORDER BY cl.created_at DESC
            LIMIT $2
            "#,
        )
        .bind(card_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(likers)
    }

    // ========================================================================
    // Social Interactions - Comments
    // Requirements: 8.3, 8.4
    // ========================================================================

    /// Add a comment to a card
    /// Requirements: 8.3
    /// 
    /// When a user comments on a card, the system SHALL store comment and associate with card and user.
    pub async fn add_comment(
        &self,
        card_id: &Uuid,
        user_id: &Uuid,
        content: &str,
    ) -> Result<crate::models::card::Comment, AppError> {
        // Validate content
        let content = content.trim();
        if content.is_empty() {
            return Err(AppError::Validation("Comment content cannot be empty".to_string()));
        }
        if content.len() > 1000 {
            return Err(AppError::Validation("Comment must be 1000 characters or less".to_string()));
        }

        // Verify card exists and is not deleted
        let card_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if card_exists == 0 {
            return Err(AppError::NotFound("Card not found".to_string()));
        }

        let comment_id = Uuid::new_v4();

        // Insert comment
        let comment_row = sqlx::query_as::<_, crate::models::card::CommentRow>(
            r#"
            INSERT INTO card_comments (id, card_id, user_id, content)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(comment_id)
        .bind(card_id)
        .bind(user_id)
        .bind(content)
        .fetch_one(&self.pool)
        .await?;

        // Increment comment count
        sqlx::query(
            r#"
            UPDATE cards 
            SET comment_count = comment_count + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            "#,
        )
        .bind(card_id)
        .execute(&self.pool)
        .await?;

        // Get user info
        let user = self.get_user_summary(user_id).await?;

        Ok(comment_row.to_comment(user))
    }

    /// Delete a comment
    /// Requirements: 8.4
    /// 
    /// When a user deletes their comment, the system SHALL remove the comment.
    /// Only the comment author can delete their own comment.
    pub async fn delete_comment(
        &self,
        comment_id: &Uuid,
        user_id: &Uuid,
    ) -> Result<(), AppError> {
        // Fetch the comment and verify ownership
        let comment_row = sqlx::query_as::<_, crate::models::card::CommentRow>(
            "SELECT * FROM card_comments WHERE id = $1 AND is_deleted = false"
        )
        .bind(comment_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Comment not found".to_string()))?;

        // Verify ownership
        if comment_row.user_id != *user_id {
            return Err(AppError::Forbidden);
        }

        // Soft delete the comment
        sqlx::query(
            "UPDATE card_comments SET is_deleted = true WHERE id = $1"
        )
        .bind(comment_id)
        .execute(&self.pool)
        .await?;

        // Decrement comment count
        sqlx::query(
            r#"
            UPDATE cards 
            SET comment_count = GREATEST(comment_count - 1, 0), updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            "#,
        )
        .bind(comment_row.card_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get comments for a card with pagination
    /// Requirements: 8.3
    pub async fn get_comments(
        &self,
        card_id: &Uuid,
        pagination: &Pagination,
    ) -> Result<Vec<crate::models::card::Comment>, AppError> {
        // Verify card exists
        let card_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if card_exists == 0 {
            return Err(AppError::NotFound("Card not found".to_string()));
        }

        // Fetch comments
        let comment_rows = sqlx::query_as::<_, crate::models::card::CommentRow>(
            r#"
            SELECT * FROM card_comments
            WHERE card_id = $1 AND is_deleted = false
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(card_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        // Convert to Comment with user info
        let mut comments = Vec::new();
        for row in comment_rows {
            let user = self.get_user_summary(&row.user_id).await?;
            comments.push(row.to_comment(user));
        }

        Ok(comments)
    }

    /// Get comment count for a card
    /// Requirements: 8.3
    pub async fn get_comment_count(&self, card_id: &Uuid) -> Result<i32, AppError> {
        let comment_count = sqlx::query_scalar::<_, i32>(
            "SELECT comment_count FROM cards WHERE id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        Ok(comment_count)
    }

    /// Get actual comment count from the comments table
    /// This is used for verification/consistency checks
    pub async fn get_actual_comment_count(&self, card_id: &Uuid) -> Result<i64, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_comments WHERE card_id = $1 AND is_deleted = false"
        )
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    // ========================================================================
    // Collection Management
    // Requirements: 7.1, 7.2, 7.3, 7.4, 7.7, 7.8
    // ========================================================================

    /// Get all cards created by a user (without pagination)
    /// Requirements: 7.1
    /// 
    /// Returns all cards created by the specified user, ordered by creation time (newest first).
    pub async fn get_user_cards(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LifeCard>, AppError> {
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT * FROM cards
            WHERE creator_id = $1 AND is_deleted = false
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(user_id, &card_row.id).await?;
            // User's own cards are not "collected" in the exchange sense
            cards.push(card_row.to_life_card(creator, is_liked, false));
        }

        Ok(cards)
    }

    /// Get all cards collected by a user through exchange (without pagination)
    /// Requirements: 7.2
    /// 
    /// Returns all cards obtained by the user through exchange, ordered by collection time (newest first).
    pub async fn get_collected_cards(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LifeCard>, AppError> {
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT c.* FROM cards c
            INNER JOIN card_collections cc ON cc.card_id = c.id
            WHERE cc.user_id = $1 AND c.is_deleted = false
            ORDER BY cc.collected_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(user_id, &card_row.id).await?;
            // These are collected cards, so is_collected is always true
            cards.push(card_row.to_life_card(creator, is_liked, true));
        }

        Ok(cards)
    }

    /// Create a new collection folder
    /// Requirements: 7.3
    /// 
    /// Creates a named folder for organizing collected cards.
    pub async fn create_folder(
        &self,
        user_id: &Uuid,
        name: &str,
    ) -> Result<crate::models::card::CardFolder, AppError> {
        // Validate folder name
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("Folder name cannot be empty".to_string()));
        }
        if name.len() > 100 {
            return Err(AppError::Validation("Folder name must be 100 characters or less".to_string()));
        }

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

        // Check for duplicate folder name for this user
        let duplicate_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM collection_folders WHERE user_id = $1 AND name = $2"
        )
        .bind(user_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await?;

        if duplicate_exists > 0 {
            return Err(AppError::BusinessLogic(
                "A folder with this name already exists".to_string()
            ));
        }

        let folder_id = Uuid::new_v4();

        // Create the folder
        let folder = sqlx::query_as::<_, crate::models::card::CardFolder>(
            r#"
            INSERT INTO collection_folders (id, user_id, name)
            VALUES ($1, $2, $3)
            RETURNING *
            "#,
        )
        .bind(folder_id)
        .bind(user_id)
        .bind(name)
        .fetch_one(&self.pool)
        .await?;

        Ok(folder)
    }

    /// Get all folders for a user
    /// Requirements: 7.3
    /// 
    /// Returns all collection folders created by the user, ordered by creation time.
    pub async fn get_folders(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<crate::models::card::CardFolder>, AppError> {
        let folders = sqlx::query_as::<_, crate::models::card::CardFolder>(
            r#"
            SELECT * FROM collection_folders
            WHERE user_id = $1
            ORDER BY created_at ASC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(folders)
    }

    /// Move a collected card to a folder
    /// Requirements: 7.4
    /// 
    /// Moves a card from the user's collection to a specific folder.
    /// The card must be in the user's collection (obtained through exchange).
    /// Pass None for folder_id to remove the card from any folder.
    pub async fn move_to_folder(
        &self,
        user_id: &Uuid,
        card_id: &Uuid,
        folder_id: Option<&Uuid>,
    ) -> Result<(), AppError> {
        // Verify the card is in the user's collection
        let collection_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_collections WHERE user_id = $1 AND card_id = $2"
        )
        .bind(user_id)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if collection_exists == 0 {
            return Err(AppError::NotFound(
                "Card not found in your collection".to_string()
            ));
        }

        // If folder_id is provided, verify the folder exists and belongs to the user
        if let Some(fid) = folder_id {
            let folder_exists = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM collection_folders WHERE id = $1 AND user_id = $2"
            )
            .bind(fid)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;

            if folder_exists == 0 {
                return Err(AppError::NotFound("Folder not found".to_string()));
            }
        }

        // Update the card's folder association
        sqlx::query(
            "UPDATE card_collections SET folder_id = $1 WHERE user_id = $2 AND card_id = $3"
        )
        .bind(folder_id)
        .bind(user_id)
        .bind(card_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get cards in a specific folder
    /// Requirements: 7.4, 7.8
    /// 
    /// Returns all cards in the specified folder.
    pub async fn get_cards_in_folder(
        &self,
        user_id: &Uuid,
        folder_id: &Uuid,
    ) -> Result<Vec<LifeCard>, AppError> {
        // Verify the folder exists and belongs to the user
        let folder_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM collection_folders WHERE id = $1 AND user_id = $2"
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if folder_exists == 0 {
            return Err(AppError::NotFound("Folder not found".to_string()));
        }

        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT c.* FROM cards c
            INNER JOIN card_collections cc ON cc.card_id = c.id
            WHERE cc.user_id = $1 AND cc.folder_id = $2 AND c.is_deleted = false
            ORDER BY cc.collected_at DESC
            "#,
        )
        .bind(user_id)
        .bind(folder_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(user_id, &card_row.id).await?;
            cards.push(card_row.to_life_card(creator, is_liked, true));
        }

        Ok(cards)
    }

    /// Delete a folder
    /// Requirements: 7.3
    /// 
    /// Deletes a folder. Cards in the folder are moved to "no folder" (folder_id = NULL).
    pub async fn delete_folder(
        &self,
        user_id: &Uuid,
        folder_id: &Uuid,
    ) -> Result<(), AppError> {
        // Verify the folder exists and belongs to the user
        let folder_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM collection_folders WHERE id = $1 AND user_id = $2"
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if folder_exists == 0 {
            return Err(AppError::NotFound("Folder not found".to_string()));
        }

        // Move all cards in this folder to "no folder"
        sqlx::query(
            "UPDATE card_collections SET folder_id = NULL WHERE folder_id = $1"
        )
        .bind(folder_id)
        .execute(&self.pool)
        .await?;

        // Delete the folder
        sqlx::query(
            "DELETE FROM collection_folders WHERE id = $1"
        )
        .bind(folder_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Rename a folder
    /// Requirements: 7.3
    pub async fn rename_folder(
        &self,
        user_id: &Uuid,
        folder_id: &Uuid,
        new_name: &str,
    ) -> Result<crate::models::card::CardFolder, AppError> {
        // Validate folder name
        let new_name = new_name.trim();
        if new_name.is_empty() {
            return Err(AppError::Validation("Folder name cannot be empty".to_string()));
        }
        if new_name.len() > 100 {
            return Err(AppError::Validation("Folder name must be 100 characters or less".to_string()));
        }

        // Verify the folder exists and belongs to the user
        let folder_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM collection_folders WHERE id = $1 AND user_id = $2"
        )
        .bind(folder_id)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if folder_exists == 0 {
            return Err(AppError::NotFound("Folder not found".to_string()));
        }

        // Check for duplicate folder name
        let duplicate_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM collection_folders WHERE user_id = $1 AND name = $2 AND id != $3"
        )
        .bind(user_id)
        .bind(new_name)
        .bind(folder_id)
        .fetch_one(&self.pool)
        .await?;

        if duplicate_exists > 0 {
            return Err(AppError::BusinessLogic(
                "A folder with this name already exists".to_string()
            ));
        }

        // Update the folder name
        let folder = sqlx::query_as::<_, crate::models::card::CardFolder>(
            r#"
            UPDATE collection_folders
            SET name = $1
            WHERE id = $2
            RETURNING *
            "#,
        )
        .bind(new_name)
        .bind(folder_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(folder)
    }

    /// Get cards by timeline (chronological view)
    /// Requirements: 7.7
    /// 
    /// Returns user's cards (both created and collected) ordered by their original creation time.
    pub async fn get_cards_timeline(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<LifeCard>, AppError> {
        // Get all cards created by the user and collected by the user
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT DISTINCT c.* FROM cards c
            LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.user_id = $1
            WHERE c.is_deleted = false
            AND (c.creator_id = $1 OR cc.user_id = $1)
            ORDER BY c.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut cards = Vec::new();
        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(user_id, &card_row.id).await?;
            let is_collected = self.has_collected_card(user_id, &card_row.id).await?;
            cards.push(card_row.to_life_card(creator, is_liked, is_collected));
        }

        Ok(cards)
    }

    /// Get cards grouped by interest category
    /// Requirements: 7.8
    /// 
    /// Returns a map of interest tags to cards that have those tags.
    pub async fn get_cards_by_category(
        &self,
        user_id: &Uuid,
    ) -> Result<std::collections::HashMap<String, Vec<LifeCard>>, AppError> {
        // Get all cards created by or collected by the user
        let card_rows = sqlx::query_as::<_, CardRow>(
            r#"
            SELECT DISTINCT c.* FROM cards c
            LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.user_id = $1
            WHERE c.is_deleted = false
            AND (c.creator_id = $1 OR cc.user_id = $1)
            ORDER BY c.created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let mut category_map: std::collections::HashMap<String, Vec<LifeCard>> = std::collections::HashMap::new();

        for card_row in card_rows {
            let creator = self.get_user_summary(&card_row.creator_id).await?;
            let is_liked = self.has_liked_card(user_id, &card_row.id).await?;
            let is_collected = self.has_collected_card(user_id, &card_row.id).await?;
            let card = card_row.to_life_card(creator, is_liked, is_collected);

            // Add card to each of its interest tag categories
            for tag in &card.interest_tags {
                category_map
                    .entry(tag.clone())
                    .or_insert_with(Vec::new)
                    .push(card.clone());
            }

            // If no interest tags, add to "uncategorized"
            if card.interest_tags.is_empty() {
                category_map
                    .entry("uncategorized".to_string())
                    .or_insert_with(Vec::new)
                    .push(card);
            }
        }

        Ok(category_map)
    }

    /// Add a card to user's collection (used by exchange service)
    /// Requirements: 7.2
    /// 
    /// This is called when an exchange is completed to add the card to the buyer's collection.
    pub async fn add_to_collection(
        &self,
        user_id: &Uuid,
        card_id: &Uuid,
    ) -> Result<(), AppError> {
        // Check if already in collection
        let already_collected = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_collections WHERE user_id = $1 AND card_id = $2"
        )
        .bind(user_id)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if already_collected > 0 {
            // Already in collection, no-op
            return Ok(());
        }

        // Add to collection
        sqlx::query(
            r#"
            INSERT INTO card_collections (id, user_id, card_id)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(card_id)
        .execute(&self.pool)
        .await?;

        // Increment the card's exchange count
        sqlx::query(
            "UPDATE cards SET exchange_count = exchange_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1"
        )
        .bind(card_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
