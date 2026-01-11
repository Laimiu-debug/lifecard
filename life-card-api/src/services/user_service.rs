use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::models::common::{PaginatedResponse, Pagination, PaginationMeta};
use crate::models::user::{AuthResult, CoinReason, CoinTransaction, ProfileUpdateData, User, UserProfile, UserSummary};
use crate::utils::{jwt, password, validation};

/// User service for handling user-related operations
pub struct UserService {
    pool: PgPool,
    config: Config,
}

impl UserService {
    /// Create a new UserService instance
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self { pool, config }
    }

    /// Register a new user with email and password
    pub async fn register(&self, email: &str, password_raw: &str) -> Result<AuthResult, AppError> {
        // Validate email format
        if !validation::is_valid_email(email) {
            return Err(AppError::Validation("Invalid email format".to_string()));
        }

        // Validate password strength
        if !validation::is_valid_password(password_raw) {
            return Err(AppError::Validation(
                "Password must be at least 8 characters".to_string(),
            ));
        }

        // Check if email already exists
        let existing_user = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE email = $1"
        )
        .bind(email)
        .fetch_one(&self.pool)
        .await?;

        if existing_user > 0 {
            return Err(AppError::Validation("Email already registered".to_string()));
        }

        // Hash password
        let password_hash = password::hash_password(password_raw)?;

        // Create user with default coin balance
        let user_id = Uuid::new_v4();
        let default_balance = self.config.default_coin_balance;

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (id, email, password_hash, coin_balance, level)
            VALUES ($1, $2, $3, $4, 1)
            RETURNING *
            "#,
        )
        .bind(user_id)
        .bind(email)
        .bind(&password_hash)
        .bind(default_balance)
        .fetch_one(&self.pool)
        .await?;

        // Generate JWT token
        let token = jwt::generate_token(
            user.id,
            &self.config.jwt_secret,
            self.config.jwt_expiration_hours,
        )?;

        // Get interest tags (empty for new user)
        let interest_tags = self.get_interest_tags(&user.id).await?;

        Ok(AuthResult {
            token,
            user: user.to_profile(interest_tags),
        })
    }

    /// Login with email and password
    pub async fn login(&self, email: &str, password_raw: &str) -> Result<AuthResult, AppError> {
        // Validate inputs
        if !validation::is_valid_email(email) {
            return Err(AppError::Validation("Invalid email format".to_string()));
        }

        if !validation::is_not_empty(password_raw) {
            return Err(AppError::Validation("Password is required".to_string()));
        }

        // Find user by email
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1"
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::Unauthorized)?;

        // Verify password (user must have password_hash for email login)
        let password_hash = user.password_hash.as_ref()
            .ok_or_else(|| AppError::Unauthorized)?;
        if !password::verify_password(password_raw, password_hash)? {
            return Err(AppError::Unauthorized);
        }

        // Generate JWT token
        let token = jwt::generate_token(
            user.id,
            &self.config.jwt_secret,
            self.config.jwt_expiration_hours,
        )?;

        // Get interest tags
        let interest_tags = self.get_interest_tags(&user.id).await?;

        Ok(AuthResult {
            token,
            user: user.to_profile(interest_tags),
        })
    }

    /// Get user by ID
    pub async fn get_user_by_id(&self, user_id: &Uuid) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    /// Get user profile by ID
    pub async fn get_profile(&self, user_id: &Uuid) -> Result<UserProfile, AppError> {
        let user = self
            .get_user_by_id(user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        let interest_tags = self.get_interest_tags(user_id).await?;

        Ok(user.to_profile(interest_tags))
    }

    /// Get interest tags for a user
    pub async fn get_interest_tags(&self, user_id: &Uuid) -> Result<Vec<String>, AppError> {
        let tags = sqlx::query_scalar::<_, String>(
            "SELECT tag FROM user_interest_tags WHERE user_id = $1 ORDER BY created_at"
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(tags)
    }

    /// Update user profile information
    /// Requirements: 2.1, 2.2, 2.3
    pub async fn update_profile(
        &self,
        user_id: &Uuid,
        data: ProfileUpdateData,
    ) -> Result<UserProfile, AppError> {
        // Validate nickname if provided
        if let Some(ref nickname) = data.nickname {
            if !validation::is_not_empty(nickname) {
                return Err(AppError::Validation("Nickname cannot be empty".to_string()));
            }
            if nickname.len() > 100 {
                return Err(AppError::Validation("Nickname must be 100 characters or less".to_string()));
            }
        }

        // Validate bio length if provided
        if let Some(ref bio) = data.bio {
            if bio.len() > 500 {
                return Err(AppError::Validation("Bio must be 500 characters or less".to_string()));
            }
        }

        // Validate location length if provided
        if let Some(ref location) = data.location {
            if location.len() > 200 {
                return Err(AppError::Validation("Location must be 200 characters or less".to_string()));
            }
        }

        // Convert age_range to database string format
        let age_range_str = data.age_range.as_ref().map(|ar| ar.to_db_str().to_string());

        // Update user profile
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users 
            SET 
                nickname = COALESCE($1, nickname),
                bio = COALESCE($2, bio),
                age_range = COALESCE($3, age_range),
                location = COALESCE($4, location),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
            "#,
        )
        .bind(&data.nickname)
        .bind(&data.bio)
        .bind(&age_range_str)
        .bind(&data.location)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        // Get interest tags
        let interest_tags = self.get_interest_tags(user_id).await?;

        Ok(user.to_profile(interest_tags))
    }

    /// Set interest tags for a user (replaces existing tags)
    /// Requirements: 2.3
    pub async fn set_interest_tags(
        &self,
        user_id: &Uuid,
        tags: Vec<String>,
    ) -> Result<(), AppError> {
        // Validate tags
        for tag in &tags {
            if !validation::is_not_empty(tag) {
                return Err(AppError::Validation("Tags cannot be empty".to_string()));
            }
            if tag.len() > 50 {
                return Err(AppError::Validation("Each tag must be 50 characters or less".to_string()));
            }
        }

        // Limit number of tags
        if tags.len() > 20 {
            return Err(AppError::Validation("Maximum 20 interest tags allowed".to_string()));
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

        // Delete existing tags
        sqlx::query("DELETE FROM user_interest_tags WHERE user_id = $1")
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        // Insert new tags (deduplicated)
        let unique_tags: Vec<String> = tags
            .into_iter()
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        for tag in unique_tags {
            sqlx::query(
                r#"
                INSERT INTO user_interest_tags (id, user_id, tag)
                VALUES ($1, $2, $3)
                "#,
            )
            .bind(Uuid::new_v4())
            .bind(user_id)
            .bind(&tag)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    /// Upload avatar image URL
    /// Requirements: 2.2
    pub async fn upload_avatar(
        &self,
        user_id: &Uuid,
        avatar_url: &str,
    ) -> Result<String, AppError> {
        // Validate URL length
        if avatar_url.len() > 500 {
            return Err(AppError::Validation("Avatar URL must be 500 characters or less".to_string()));
        }

        // Update avatar URL
        sqlx::query(
            r#"
            UPDATE users 
            SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            "#,
        )
        .bind(avatar_url)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(avatar_url.to_string())
    }

    /// Get public profile for viewing another user
    /// Requirements: 2.5
    pub async fn get_public_profile(
        &self,
        user_id: &Uuid,
        viewer_id: Option<&Uuid>,
    ) -> Result<UserProfile, AppError> {
        let user = self
            .get_user_by_id(user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        let interest_tags = self.get_interest_tags(user_id).await?;

        // For public profile, we return the same profile structure
        // Privacy filtering can be applied at the handler level if needed
        // based on viewer_id and follow relationship
        let _ = viewer_id; // Reserved for future privacy filtering

        Ok(user.to_profile(interest_tags))
    }

    /// Add coins to user balance
    pub async fn add_coins(
        &self,
        user_id: &Uuid,
        amount: i32,
        reason: CoinReason,
        reference_id: Option<Uuid>,
    ) -> Result<i32, AppError> {
        if amount <= 0 {
            return Err(AppError::Validation("Amount must be positive".to_string()));
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

    /// Deduct coins from user balance
    pub async fn deduct_coins(
        &self,
        user_id: &Uuid,
        amount: i32,
        reason: CoinReason,
        reference_id: Option<Uuid>,
    ) -> Result<i32, AppError> {
        if amount <= 0 {
            return Err(AppError::Validation("Amount must be positive".to_string()));
        }

        // Check current balance
        let current_balance = sqlx::query_scalar::<_, i32>(
            "SELECT coin_balance FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        if current_balance < amount {
            return Err(AppError::BusinessLogic("Insufficient coin balance".to_string()));
        }

        // Update balance
        let new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance - $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(amount)
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Record transaction (negative amount for deduction)
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(-amount)
        .bind(reason.to_string())
        .bind(reference_id)
        .bind(new_balance)
        .execute(&self.pool)
        .await?;

        Ok(new_balance)
    }

    /// Get coin balance for a user
    pub async fn get_coin_balance(&self, user_id: &Uuid) -> Result<i32, AppError> {
        let balance = sqlx::query_scalar::<_, i32>(
            "SELECT coin_balance FROM users WHERE id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(balance)
    }

    /// Get coin transaction history for a user with pagination
    /// Requirements: 6.5
    pub async fn get_coin_history(
        &self,
        user_id: &Uuid,
        pagination: Pagination,
    ) -> Result<PaginatedResponse<CoinTransaction>, AppError> {
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

        // Get total count
        let total_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM coin_transactions WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Get transactions with pagination (most recent first)
        let transactions = sqlx::query_as::<_, CoinTransaction>(
            r#"
            SELECT id, user_id, amount, reason, reference_id, balance_after, created_at
            FROM coin_transactions
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        Ok(PaginatedResponse {
            data: transactions,
            pagination: PaginationMeta::new(pagination.page, pagination.page_size, total_count),
        })
    }

    /// Follow another user
    /// Requirements: 8.5
    pub async fn follow_user(
        &self,
        follower_id: &Uuid,
        followee_id: &Uuid,
    ) -> Result<(), AppError> {
        // Prevent self-following
        if follower_id == followee_id {
            return Err(AppError::Validation("Cannot follow yourself".to_string()));
        }

        // Verify both users exist
        let follower_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE id = $1"
        )
        .bind(follower_id)
        .fetch_one(&self.pool)
        .await?;

        if follower_exists == 0 {
            return Err(AppError::NotFound("Follower user not found".to_string()));
        }

        let followee_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE id = $1"
        )
        .bind(followee_id)
        .fetch_one(&self.pool)
        .await?;

        if followee_exists == 0 {
            return Err(AppError::NotFound("User to follow not found".to_string()));
        }

        // Check if already following
        let already_following = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND followee_id = $2"
        )
        .bind(follower_id)
        .bind(followee_id)
        .fetch_one(&self.pool)
        .await?;

        if already_following > 0 {
            return Err(AppError::Validation("Already following this user".to_string()));
        }

        // Create follow relationship
        sqlx::query(
            r#"
            INSERT INTO follows (id, follower_id, followee_id)
            VALUES ($1, $2, $3)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(follower_id)
        .bind(followee_id)
        .execute(&self.pool)
        .await?;

        // Update follower count for followee
        sqlx::query(
            "UPDATE users SET follower_count = follower_count + 1 WHERE id = $1"
        )
        .bind(followee_id)
        .execute(&self.pool)
        .await?;

        // Update following count for follower
        sqlx::query(
            "UPDATE users SET following_count = following_count + 1 WHERE id = $1"
        )
        .bind(follower_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Unfollow a user
    /// Requirements: 8.6
    pub async fn unfollow_user(
        &self,
        follower_id: &Uuid,
        followee_id: &Uuid,
    ) -> Result<(), AppError> {
        // Prevent self-unfollowing (shouldn't happen but be safe)
        if follower_id == followee_id {
            return Err(AppError::Validation("Cannot unfollow yourself".to_string()));
        }

        // Check if follow relationship exists
        let is_following = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND followee_id = $2"
        )
        .bind(follower_id)
        .bind(followee_id)
        .fetch_one(&self.pool)
        .await?;

        if is_following == 0 {
            return Err(AppError::Validation("Not following this user".to_string()));
        }

        // Delete follow relationship
        sqlx::query(
            "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2"
        )
        .bind(follower_id)
        .bind(followee_id)
        .execute(&self.pool)
        .await?;

        // Update follower count for followee
        sqlx::query(
            "UPDATE users SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = $1"
        )
        .bind(followee_id)
        .execute(&self.pool)
        .await?;

        // Update following count for follower
        sqlx::query(
            "UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = $1"
        )
        .bind(follower_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get followers of a user with pagination
    /// Requirements: 8.7
    pub async fn get_followers(
        &self,
        user_id: &Uuid,
        pagination: Pagination,
    ) -> Result<PaginatedResponse<UserSummary>, AppError> {
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

        // Get total count
        let total_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM follows WHERE followee_id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Get followers with pagination
        let followers = sqlx::query_as::<_, UserSummary>(
            r#"
            SELECT u.id, u.nickname, u.avatar_url as avatar, u.level
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            WHERE f.followee_id = $1
            ORDER BY f.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        Ok(PaginatedResponse {
            data: followers,
            pagination: PaginationMeta::new(pagination.page, pagination.page_size, total_count),
        })
    }

    /// Get users that a user is following with pagination
    /// Requirements: 8.7
    pub async fn get_following(
        &self,
        user_id: &Uuid,
        pagination: Pagination,
    ) -> Result<PaginatedResponse<UserSummary>, AppError> {
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

        // Get total count
        let total_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM follows WHERE follower_id = $1"
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Get following with pagination
        let following = sqlx::query_as::<_, UserSummary>(
            r#"
            SELECT u.id, u.nickname, u.avatar_url as avatar, u.level
            FROM follows f
            JOIN users u ON f.followee_id = u.id
            WHERE f.follower_id = $1
            ORDER BY f.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        Ok(PaginatedResponse {
            data: following,
            pagination: PaginationMeta::new(pagination.page, pagination.page_size, total_count),
        })
    }

    /// Check if a user is following another user
    pub async fn is_following(
        &self,
        follower_id: &Uuid,
        followee_id: &Uuid,
    ) -> Result<bool, AppError> {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM follows WHERE follower_id = $1 AND followee_id = $2"
        )
        .bind(follower_id)
        .bind(followee_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(count > 0)
    }
}
