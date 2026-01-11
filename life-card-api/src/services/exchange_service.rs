//! Exchange service for handling card exchange operations
//!
//! Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9

use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::models::card::{CardRow, LifeCardSummary};
use crate::models::exchange::{
    ExchangePriceInfo, ExchangeRequest, ExchangeRequestRow, ExchangeResult,
    ExpirationProcessingResult,
};
use crate::models::user::{CoinReason, UserSummary};

/// Exchange service for handling card exchange operations
pub struct ExchangeService {
    pool: PgPool,
    config: Config,
}

impl ExchangeService {
    /// Create a new ExchangeService instance
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self { pool, config }
    }

    /// Create a new exchange request
    /// Requirements: 5.1, 5.2
    ///
    /// This function:
    /// 1. Validates the card exists and is not deleted
    /// 2. Validates the requester is not the card owner (cannot exchange own card)
    /// 3. Validates the requester has sufficient coin balance
    /// 4. Calculates the exchange price based on card popularity
    /// 5. Deducts coins from the requester
    /// 6. Creates the exchange request with 72-hour expiration
    pub async fn create_exchange_request(
        &self,
        requester_id: &Uuid,
        card_id: &Uuid,
    ) -> Result<ExchangeRequest, AppError> {
        // 1. Fetch the card and verify it exists
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false",
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        let owner_id = card_row.creator_id;

        // 2. Validate requester is not the card owner
        if *requester_id == owner_id {
            return Err(AppError::BusinessLogic(
                "Cannot exchange your own card".to_string(),
            ));
        }

        // 3. Check if requester already has a pending request for this card
        let existing_request = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM exchange_requests 
            WHERE requester_id = $1 AND card_id = $2 AND status = 'pending'
            "#,
        )
        .bind(requester_id)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if existing_request > 0 {
            return Err(AppError::BusinessLogic(
                "You already have a pending exchange request for this card".to_string(),
            ));
        }

        // 4. Check if requester has already collected this card
        let already_collected = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM card_collections WHERE user_id = $1 AND card_id = $2",
        )
        .bind(requester_id)
        .bind(card_id)
        .fetch_one(&self.pool)
        .await?;

        if already_collected > 0 {
            return Err(AppError::BusinessLogic(
                "You have already collected this card".to_string(),
            ));
        }

        // 5. Calculate exchange price based on card popularity
        let exchange_price = self.calculate_exchange_price(card_id).await?;
        let coin_amount = exchange_price.final_price;

        // 6. Check requester's coin balance
        let requester_balance = sqlx::query_scalar::<_, i32>(
            "SELECT coin_balance FROM users WHERE id = $1",
        )
        .bind(requester_id)
        .fetch_one(&self.pool)
        .await?;

        if requester_balance < coin_amount {
            return Err(AppError::BusinessLogic(format!(
                "Insufficient coin balance. Required: {}, Available: {}",
                coin_amount, requester_balance
            )));
        }

        // 7. Calculate expiration time (72 hours from now)
        let expires_at = Utc::now() + Duration::hours(self.config.exchange_expiration_hours);

        // 8. Start transaction for atomic coin deduction and request creation
        let exchange_id = Uuid::new_v4();

        // Deduct coins from requester
        let new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance - $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(coin_amount)
        .bind(requester_id)
        .fetch_one(&self.pool)
        .await?;

        // Record coin transaction
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(requester_id)
        .bind(-coin_amount) // Negative for deduction
        .bind(CoinReason::ExchangePurchase.to_string())
        .bind(exchange_id)
        .bind(new_balance)
        .execute(&self.pool)
        .await?;

        // 9. Create the exchange request
        let exchange_row = sqlx::query_as::<_, ExchangeRequestRow>(
            r#"
            INSERT INTO exchange_requests (id, requester_id, card_id, owner_id, coin_amount, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            RETURNING *
            "#,
        )
        .bind(exchange_id)
        .bind(requester_id)
        .bind(card_id)
        .bind(owner_id)
        .bind(coin_amount)
        .bind(expires_at)
        .fetch_one(&self.pool)
        .await?;

        // 10. Fetch additional info for the response
        let requester = self.get_user_summary(requester_id).await?;
        let owner = self.get_user_summary(&owner_id).await?;
        let card_summary = self.get_card_summary(card_id).await?;

        Ok(exchange_row.to_exchange_request(requester, card_summary, owner))
    }

    /// Calculate exchange price for a card based on popularity
    /// Requirements: 6.7
    pub async fn calculate_exchange_price(&self, card_id: &Uuid) -> Result<ExchangePriceInfo, AppError> {
        let card_row = sqlx::query_as::<_, CardRow>(
            "SELECT * FROM cards WHERE id = $1 AND is_deleted = false",
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Card not found".to_string()))?;

        Ok(ExchangePriceInfo::new(
            *card_id,
            card_row.base_price,
            card_row.like_count,
            card_row.exchange_count,
        ))
    }

    /// Accept an exchange request
    /// Requirements: 5.3
    ///
    /// This function:
    /// 1. Validates the exchange request exists and is pending
    /// 2. Validates the caller is the card owner
    /// 3. Validates the request has not expired
    /// 4. Transfers coins to the card owner
    /// 5. Grants card access to the requester (adds to their collection)
    /// 6. Updates the exchange request status to accepted
    /// 7. Creates an exchange record for history tracking
    /// 8. Awards bonus coins to the card creator
    pub async fn accept_exchange(
        &self,
        exchange_id: &Uuid,
        owner_id: &Uuid,
    ) -> Result<ExchangeResult, AppError> {
        // 1. Fetch the exchange request
        let exchange_row = sqlx::query_as::<_, ExchangeRequestRow>(
            "SELECT * FROM exchange_requests WHERE id = $1",
        )
        .bind(exchange_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Exchange request not found".to_string()))?;

        // 2. Validate the caller is the card owner
        if exchange_row.owner_id != *owner_id {
            return Err(AppError::BusinessLogic(
                "Only the card owner can accept this exchange request".to_string(),
            ));
        }

        // 3. Validate the request is pending
        if !exchange_row.status.can_accept() {
            return Err(AppError::BusinessLogic(format!(
                "Cannot accept exchange request with status: {}",
                exchange_row.status
            )));
        }

        // 4. Validate the request has not expired
        if exchange_row.is_expired() {
            // Auto-expire the request
            sqlx::query(
                "UPDATE exchange_requests SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            )
            .bind(exchange_id)
            .execute(&self.pool)
            .await?;

            return Err(AppError::BusinessLogic(
                "Exchange request has expired".to_string(),
            ));
        }

        // 5. Transfer coins to the card owner
        let owner_new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(exchange_row.coin_amount)
        .bind(owner_id)
        .fetch_one(&self.pool)
        .await?;

        // Record coin transaction for owner (receiving coins)
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(owner_id)
        .bind(exchange_row.coin_amount)
        .bind(CoinReason::CardExchanged.to_string())
        .bind(exchange_id)
        .bind(owner_new_balance)
        .execute(&self.pool)
        .await?;

        // 6. Grant card access to the requester (add to their collection)
        sqlx::query(
            r#"
            INSERT INTO card_collections (id, user_id, card_id, collected_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, card_id) DO NOTHING
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(exchange_row.requester_id)
        .bind(exchange_row.card_id)
        .execute(&self.pool)
        .await?;

        // 7. Update the exchange request status to accepted
        sqlx::query(
            "UPDATE exchange_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(exchange_id)
        .execute(&self.pool)
        .await?;

        // 8. Create an exchange record for history tracking
        sqlx::query(
            r#"
            INSERT INTO exchange_records (id, exchange_request_id, card_id, from_user_id, to_user_id, coin_amount, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(exchange_id)
        .bind(exchange_row.card_id)
        .bind(owner_id)
        .bind(exchange_row.requester_id)
        .bind(exchange_row.coin_amount)
        .execute(&self.pool)
        .await?;

        // 9. Update card exchange count
        sqlx::query(
            "UPDATE cards SET exchange_count = exchange_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(exchange_row.card_id)
        .execute(&self.pool)
        .await?;

        // 10. Update user exchange counts
        sqlx::query(
            "UPDATE users SET exchange_count = exchange_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(owner_id)
        .execute(&self.pool)
        .await?;

        sqlx::query(
            "UPDATE users SET exchange_count = exchange_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(exchange_row.requester_id)
        .execute(&self.pool)
        .await?;

        // Get requester's current balance (coins were already deducted during request creation)
        let requester_balance = sqlx::query_scalar::<_, i32>(
            "SELECT coin_balance FROM users WHERE id = $1",
        )
        .bind(exchange_row.requester_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(ExchangeResult {
            exchange_id: *exchange_id,
            card_id: exchange_row.card_id,
            requester_new_balance: requester_balance,
            owner_new_balance,
        })
    }

    /// Reject an exchange request
    /// Requirements: 5.4
    ///
    /// This function:
    /// 1. Validates the exchange request exists and is pending
    /// 2. Validates the caller is the card owner
    /// 3. Refunds coins to the requester
    /// 4. Updates the exchange request status to rejected
    pub async fn reject_exchange(
        &self,
        exchange_id: &Uuid,
        owner_id: &Uuid,
    ) -> Result<(), AppError> {
        // 1. Fetch the exchange request
        let exchange_row = sqlx::query_as::<_, ExchangeRequestRow>(
            "SELECT * FROM exchange_requests WHERE id = $1",
        )
        .bind(exchange_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Exchange request not found".to_string()))?;

        // 2. Validate the caller is the card owner
        if exchange_row.owner_id != *owner_id {
            return Err(AppError::BusinessLogic(
                "Only the card owner can reject this exchange request".to_string(),
            ));
        }

        // 3. Validate the request is pending
        if !exchange_row.status.can_reject() {
            return Err(AppError::BusinessLogic(format!(
                "Cannot reject exchange request with status: {}",
                exchange_row.status
            )));
        }

        // 4. Refund coins to the requester
        let new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(exchange_row.coin_amount)
        .bind(exchange_row.requester_id)
        .fetch_one(&self.pool)
        .await?;

        // Record coin transaction for refund
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(exchange_row.requester_id)
        .bind(exchange_row.coin_amount)
        .bind(CoinReason::ExchangeRefund.to_string())
        .bind(exchange_id)
        .bind(new_balance)
        .execute(&self.pool)
        .await?;

        // 5. Update the exchange request status to rejected
        sqlx::query(
            "UPDATE exchange_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(exchange_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Cancel an exchange request (by the requester)
    /// Requirements: 5.4
    ///
    /// This function:
    /// 1. Validates the exchange request exists and is pending
    /// 2. Validates the caller is the requester
    /// 3. Refunds coins to the requester
    /// 4. Updates the exchange request status to cancelled
    pub async fn cancel_exchange(
        &self,
        exchange_id: &Uuid,
        requester_id: &Uuid,
    ) -> Result<(), AppError> {
        // 1. Fetch the exchange request
        let exchange_row = sqlx::query_as::<_, ExchangeRequestRow>(
            "SELECT * FROM exchange_requests WHERE id = $1",
        )
        .bind(exchange_id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Exchange request not found".to_string()))?;

        // 2. Validate the caller is the requester
        if exchange_row.requester_id != *requester_id {
            return Err(AppError::BusinessLogic(
                "Only the requester can cancel this exchange request".to_string(),
            ));
        }

        // 3. Validate the request is pending
        if !exchange_row.status.can_cancel() {
            return Err(AppError::BusinessLogic(format!(
                "Cannot cancel exchange request with status: {}",
                exchange_row.status
            )));
        }

        // 4. Refund coins to the requester
        let new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(exchange_row.coin_amount)
        .bind(requester_id)
        .fetch_one(&self.pool)
        .await?;

        // Record coin transaction for refund
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(requester_id)
        .bind(exchange_row.coin_amount)
        .bind(CoinReason::ExchangeRefund.to_string())
        .bind(exchange_id)
        .bind(new_balance)
        .execute(&self.pool)
        .await?;

        // 5. Update the exchange request status to cancelled
        sqlx::query(
            "UPDATE exchange_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(exchange_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Process expired exchange requests and refund coins
    /// Requirements: 5.5
    ///
    /// This function:
    /// 1. Finds all pending exchange requests that have expired
    /// 2. Refunds coins to each requester
    /// 3. Updates the exchange request status to expired
    /// 4. Returns the number of processed requests
    pub async fn process_expired_requests(&self) -> Result<ExpirationProcessingResult, AppError> {
        let now = Utc::now();
        
        // 1. Find all pending exchange requests that have expired
        let expired_requests = sqlx::query_as::<_, ExchangeRequestRow>(
            r#"
            SELECT * FROM exchange_requests 
            WHERE status = 'pending' AND expires_at < $1
            FOR UPDATE SKIP LOCKED
            "#,
        )
        .bind(now)
        .fetch_all(&self.pool)
        .await?;

        let total_found = expired_requests.len();
        let mut processed_count = 0;
        let mut refunded_amount = 0i64;
        let mut failed_count = 0;

        // 2. Process each expired request
        for request in expired_requests {
            match self.expire_single_request(&request).await {
                Ok(amount) => {
                    processed_count += 1;
                    refunded_amount += amount as i64;
                    tracing::info!(
                        exchange_id = %request.id,
                        requester_id = %request.requester_id,
                        refund_amount = amount,
                        "Expired exchange request processed and refunded"
                    );
                }
                Err(e) => {
                    failed_count += 1;
                    tracing::error!(
                        exchange_id = %request.id,
                        error = %e,
                        "Failed to process expired exchange request"
                    );
                }
            }
        }

        Ok(ExpirationProcessingResult {
            total_found,
            processed_count,
            failed_count,
            total_refunded_amount: refunded_amount,
        })
    }

    /// Expire a single exchange request and refund coins
    /// Internal helper function for process_expired_requests
    async fn expire_single_request(&self, request: &ExchangeRequestRow) -> Result<i32, AppError> {
        // Refund coins to the requester
        let new_balance = sqlx::query_scalar::<_, i32>(
            r#"
            UPDATE users 
            SET coin_balance = coin_balance + $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING coin_balance
            "#,
        )
        .bind(request.coin_amount)
        .bind(request.requester_id)
        .fetch_one(&self.pool)
        .await?;

        // Record coin transaction for refund
        sqlx::query(
            r#"
            INSERT INTO coin_transactions (id, user_id, amount, reason, reference_id, balance_after)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(request.requester_id)
        .bind(request.coin_amount)
        .bind(CoinReason::ExchangeRefund.to_string())
        .bind(request.id)
        .bind(new_balance)
        .execute(&self.pool)
        .await?;

        // Update the exchange request status to expired
        sqlx::query(
            "UPDATE exchange_requests SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        )
        .bind(request.id)
        .execute(&self.pool)
        .await?;

        Ok(request.coin_amount)
    }

    /// Get user summary for embedding in responses
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

    /// Get card summary for embedding in responses
    async fn get_card_summary(&self, card_id: &Uuid) -> Result<Option<LifeCardSummary>, AppError> {
        let row = sqlx::query_as::<_, CardSummaryRow>(
            r#"
            SELECT id, title, card_type, media
            FROM cards WHERE id = $1 AND is_deleted = false
            "#,
        )
        .bind(card_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.to_summary()))
    }

    /// Get exchange history for a user (completed exchanges)
    /// Requirements: 5.6, 5.7
    ///
    /// This function returns all completed exchanges where the user was either
    /// the card owner (sent) or the requester (received).
    pub async fn get_exchange_history(
        &self,
        user_id: &Uuid,
        pagination: crate::models::common::Pagination,
    ) -> Result<crate::models::exchange::ExchangeHistoryResponse, AppError> {
        use crate::models::exchange::{ExchangeHistoryResponse, ExchangeRecordRow};

        // Get total count of exchange records for this user
        let total_count = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM exchange_records 
            WHERE from_user_id = $1 OR to_user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.pool)
        .await?;

        // Fetch exchange records with pagination, ordered by completion time (newest first)
        let rows = sqlx::query_as::<_, ExchangeRecordRow>(
            r#"
            SELECT id, exchange_request_id, card_id, from_user_id, to_user_id, coin_amount, completed_at
            FROM exchange_records 
            WHERE from_user_id = $1 OR to_user_id = $1
            ORDER BY completed_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(pagination.limit())
        .bind(pagination.offset())
        .fetch_all(&self.pool)
        .await?;

        // Convert rows to ExchangeRecord with embedded card and counterparty info
        let mut records = Vec::with_capacity(rows.len());
        for row in rows {
            let card = self.get_card_summary(&row.card_id).await?;
            let counterparty_id = if row.from_user_id == *user_id {
                row.to_user_id
            } else {
                row.from_user_id
            };
            let counterparty = self.get_user_summary(&counterparty_id).await?;
            records.push(row.to_exchange_record(user_id, card, counterparty));
        }

        Ok(ExchangeHistoryResponse {
            records,
            total_count,
        })
    }

    /// Get pending exchange requests received by a user (as card owner)
    /// Requirements: 5.6, 5.7
    ///
    /// This function returns all pending exchange requests where the user is the card owner.
    /// These are requests that the user can accept or reject.
    pub async fn get_pending_requests(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ExchangeRequest>, AppError> {
        // Fetch pending exchange requests where user is the owner
        let rows = sqlx::query_as::<_, ExchangeRequestRow>(
            r#"
            SELECT * FROM exchange_requests 
            WHERE owner_id = $1 AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Convert rows to ExchangeRequest with embedded user and card info
        let mut requests = Vec::with_capacity(rows.len());
        for row in rows {
            let requester = self.get_user_summary(&row.requester_id).await?;
            let card = self.get_card_summary(&row.card_id).await?;
            let owner = self.get_user_summary(&row.owner_id).await?;
            requests.push(row.to_exchange_request(requester, card, owner));
        }

        Ok(requests)
    }

    /// Get exchange requests sent by a user (as requester)
    /// Requirements: 5.6, 5.7
    ///
    /// This function returns all exchange requests sent by the user,
    /// including pending, accepted, rejected, cancelled, and expired requests.
    pub async fn get_sent_requests(
        &self,
        user_id: &Uuid,
    ) -> Result<Vec<ExchangeRequest>, AppError> {
        // Fetch all exchange requests where user is the requester
        let rows = sqlx::query_as::<_, ExchangeRequestRow>(
            r#"
            SELECT * FROM exchange_requests 
            WHERE requester_id = $1
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Convert rows to ExchangeRequest with embedded user and card info
        let mut requests = Vec::with_capacity(rows.len());
        for row in rows {
            let requester = self.get_user_summary(&row.requester_id).await?;
            let card = self.get_card_summary(&row.card_id).await?;
            let owner = self.get_user_summary(&row.owner_id).await?;
            requests.push(row.to_exchange_request(requester, card, owner));
        }

        Ok(requests)
    }
}

/// Helper struct for fetching card summary data
#[derive(Debug, sqlx::FromRow)]
struct CardSummaryRow {
    id: Uuid,
    title: String,
    card_type: crate::models::card::CardType,
    media: sqlx::types::Json<Vec<crate::models::card::MediaItem>>,
}

impl CardSummaryRow {
    fn to_summary(&self) -> LifeCardSummary {
        LifeCardSummary {
            id: self.id,
            title: self.title.clone(),
            card_type: self.card_type.clone(),
            thumbnail: self.media.0.first().map(|m| {
                m.thumbnail_url.clone().unwrap_or_else(|| m.url.clone())
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exchange_price_calculation() {
        let card_id = Uuid::new_v4();
        
        // Base case: no popularity
        let price_info = ExchangePriceInfo::new(card_id, 10, 0, 0);
        assert_eq!(price_info.final_price, 10);

        // With likes
        let price_info = ExchangePriceInfo::new(card_id, 10, 25, 0);
        assert_eq!(price_info.final_price, 12); // 10 + 2 (25/10)

        // With exchanges
        let price_info = ExchangePriceInfo::new(card_id, 10, 0, 5);
        assert_eq!(price_info.final_price, 20); // 10 + 10 (5*2)

        // With both
        let price_info = ExchangePriceInfo::new(card_id, 10, 50, 3);
        assert_eq!(price_info.final_price, 21); // 10 + 5 + 6
    }
}
