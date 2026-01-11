use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use super::{card::LifeCardSummary, user::UserSummary};

/// Exchange status enum - maps to PostgreSQL exchange_status enum
/// Requirements: 5.1-5.9
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

impl std::fmt::Display for ExchangeStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExchangeStatus::Pending => write!(f, "pending"),
            ExchangeStatus::Accepted => write!(f, "accepted"),
            ExchangeStatus::Rejected => write!(f, "rejected"),
            ExchangeStatus::Cancelled => write!(f, "cancelled"),
            ExchangeStatus::Expired => write!(f, "expired"),
        }
    }
}

impl ExchangeStatus {
    /// Convert from database string representation
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(ExchangeStatus::Pending),
            "accepted" => Some(ExchangeStatus::Accepted),
            "rejected" => Some(ExchangeStatus::Rejected),
            "cancelled" => Some(ExchangeStatus::Cancelled),
            "expired" => Some(ExchangeStatus::Expired),
            _ => None,
        }
    }

    /// Convert to database string representation
    pub fn to_db_str(&self) -> &'static str {
        match self {
            ExchangeStatus::Pending => "pending",
            ExchangeStatus::Accepted => "accepted",
            ExchangeStatus::Rejected => "rejected",
            ExchangeStatus::Cancelled => "cancelled",
            ExchangeStatus::Expired => "expired",
        }
    }

    /// Check if the exchange request is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            ExchangeStatus::Accepted
                | ExchangeStatus::Rejected
                | ExchangeStatus::Cancelled
                | ExchangeStatus::Expired
        )
    }

    /// Check if the exchange request can be accepted
    pub fn can_accept(&self) -> bool {
        matches!(self, ExchangeStatus::Pending)
    }

    /// Check if the exchange request can be rejected
    pub fn can_reject(&self) -> bool {
        matches!(self, ExchangeStatus::Pending)
    }

    /// Check if the exchange request can be cancelled
    pub fn can_cancel(&self) -> bool {
        matches!(self, ExchangeStatus::Pending)
    }
}

impl Default for ExchangeStatus {
    fn default() -> Self {
        ExchangeStatus::Pending
    }
}

/// Exchange request - API model for exchange requests
/// Requirements: 5.1, 5.2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRequest {
    pub id: Uuid,
    pub requester_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requester: Option<UserSummary>,
    pub card_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<LifeCardSummary>,
    pub owner_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owner: Option<UserSummary>,
    pub coin_amount: i32,
    pub status: ExchangeStatus,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

/// Database row for exchange_requests table - maps directly to PostgreSQL
/// Used for SQLx queries
#[derive(Debug, Clone, FromRow)]
pub struct ExchangeRequestRow {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub card_id: Uuid,
    pub owner_id: Uuid,
    pub coin_amount: i32,
    pub status: ExchangeStatus,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ExchangeRequestRow {
    /// Convert database row to ExchangeRequest API model
    pub fn to_exchange_request(
        &self,
        requester: Option<UserSummary>,
        card: Option<LifeCardSummary>,
        owner: Option<UserSummary>,
    ) -> ExchangeRequest {
        ExchangeRequest {
            id: self.id,
            requester_id: self.requester_id,
            requester,
            card_id: self.card_id,
            card,
            owner_id: self.owner_id,
            owner,
            coin_amount: self.coin_amount,
            status: self.status.clone(),
            expires_at: self.expires_at,
            created_at: self.created_at,
        }
    }

    /// Check if the exchange request has expired
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    /// Check if the exchange request is still pending and not expired
    pub fn is_actionable(&self) -> bool {
        self.status == ExchangeStatus::Pending && !self.is_expired()
    }
}

/// Exchange result - returned after successful exchange acceptance
/// Requirements: 5.3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeResult {
    pub exchange_id: Uuid,
    pub card_id: Uuid,
    pub requester_new_balance: i32,
    pub owner_new_balance: i32,
}

/// Exchange record - completed exchange history entry
/// Requirements: 5.6, 5.7
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRecord {
    pub id: Uuid,
    pub card_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub card: Option<LifeCardSummary>,
    pub counterparty_id: Uuid,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty: Option<UserSummary>,
    pub direction: ExchangeDirection,
    pub coin_amount: i32,
    pub completed_at: DateTime<Utc>,
}

/// Database row for exchange_records table - maps directly to PostgreSQL
/// Used for SQLx queries
#[derive(Debug, Clone, FromRow)]
pub struct ExchangeRecordRow {
    pub id: Uuid,
    pub exchange_request_id: Option<Uuid>,
    pub card_id: Uuid,
    pub from_user_id: Uuid,
    pub to_user_id: Uuid,
    pub coin_amount: i32,
    pub completed_at: DateTime<Utc>,
}

impl ExchangeRecordRow {
    /// Convert database row to ExchangeRecord API model from the perspective of a specific user
    pub fn to_exchange_record(
        &self,
        viewer_id: &Uuid,
        card: Option<LifeCardSummary>,
        counterparty: Option<UserSummary>,
    ) -> ExchangeRecord {
        let direction = if self.from_user_id == *viewer_id {
            ExchangeDirection::Sent
        } else {
            ExchangeDirection::Received
        };

        let counterparty_id = if self.from_user_id == *viewer_id {
            self.to_user_id
        } else {
            self.from_user_id
        };

        ExchangeRecord {
            id: self.id,
            card_id: self.card_id,
            card,
            counterparty_id,
            counterparty,
            direction,
            coin_amount: self.coin_amount,
            completed_at: self.completed_at,
        }
    }
}

/// Exchange direction - whether the user sent or received the card
/// Requirements: 5.6
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExchangeDirection {
    Sent,
    Received,
}

impl std::fmt::Display for ExchangeDirection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExchangeDirection::Sent => write!(f, "sent"),
            ExchangeDirection::Received => write!(f, "received"),
        }
    }
}

/// Data for creating a new exchange request
/// Requirements: 5.1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateExchangeRequestData {
    pub card_id: Uuid,
}

impl CreateExchangeRequestData {
    /// Validate the exchange request creation data
    pub fn validate(&self) -> Result<(), String> {
        // Card ID is required and must be a valid UUID (already enforced by type)
        Ok(())
    }
}

/// Default expiration duration for exchange requests (72 hours)
/// Requirements: 5.5
pub const EXCHANGE_REQUEST_EXPIRATION_HOURS: i64 = 72;

/// Calculate the expiration time for a new exchange request
/// Requirements: 5.5
pub fn calculate_expiration_time() -> DateTime<Utc> {
    Utc::now() + Duration::hours(EXCHANGE_REQUEST_EXPIRATION_HOURS)
}

/// Exchange request list response with pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRequestListResponse {
    pub requests: Vec<ExchangeRequest>,
    pub total_count: i64,
}

/// Exchange history response with pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeHistoryResponse {
    pub records: Vec<ExchangeRecord>,
    pub total_count: i64,
}

/// Result of processing expired exchange requests
/// Requirements: 5.5
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpirationProcessingResult {
    /// Total number of expired requests found
    pub total_found: usize,
    /// Number of requests successfully processed
    pub processed_count: usize,
    /// Number of requests that failed to process
    pub failed_count: usize,
    /// Total amount of coins refunded
    pub total_refunded_amount: i64,
}

impl ExpirationProcessingResult {
    /// Check if all found requests were processed successfully
    pub fn all_successful(&self) -> bool {
        self.failed_count == 0
    }

    /// Check if any requests were processed
    pub fn has_processed(&self) -> bool {
        self.processed_count > 0
    }
}

/// Exchange price calculation result
/// Requirements: 6.7
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangePriceInfo {
    pub card_id: Uuid,
    pub base_price: i32,
    pub popularity_bonus: i32,
    pub final_price: i32,
}

impl ExchangePriceInfo {
    /// Create a new exchange price info
    pub fn new(card_id: Uuid, base_price: i32, like_count: i32, exchange_count: i32) -> Self {
        // Calculate popularity bonus: +1 coin per 10 likes, +2 per exchange
        let popularity_bonus = (like_count / 10) + (exchange_count * 2);
        let final_price = base_price + popularity_bonus;

        Self {
            card_id,
            base_price,
            popularity_bonus,
            final_price,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exchange_status_display() {
        assert_eq!(ExchangeStatus::Pending.to_string(), "pending");
        assert_eq!(ExchangeStatus::Accepted.to_string(), "accepted");
        assert_eq!(ExchangeStatus::Rejected.to_string(), "rejected");
        assert_eq!(ExchangeStatus::Cancelled.to_string(), "cancelled");
        assert_eq!(ExchangeStatus::Expired.to_string(), "expired");
    }

    #[test]
    fn test_exchange_status_from_db_str() {
        assert_eq!(
            ExchangeStatus::from_db_str("pending"),
            Some(ExchangeStatus::Pending)
        );
        assert_eq!(
            ExchangeStatus::from_db_str("accepted"),
            Some(ExchangeStatus::Accepted)
        );
        assert_eq!(
            ExchangeStatus::from_db_str("rejected"),
            Some(ExchangeStatus::Rejected)
        );
        assert_eq!(
            ExchangeStatus::from_db_str("cancelled"),
            Some(ExchangeStatus::Cancelled)
        );
        assert_eq!(
            ExchangeStatus::from_db_str("expired"),
            Some(ExchangeStatus::Expired)
        );
        assert_eq!(ExchangeStatus::from_db_str("invalid"), None);
    }

    #[test]
    fn test_exchange_status_is_terminal() {
        assert!(!ExchangeStatus::Pending.is_terminal());
        assert!(ExchangeStatus::Accepted.is_terminal());
        assert!(ExchangeStatus::Rejected.is_terminal());
        assert!(ExchangeStatus::Cancelled.is_terminal());
        assert!(ExchangeStatus::Expired.is_terminal());
    }

    #[test]
    fn test_exchange_status_can_accept() {
        assert!(ExchangeStatus::Pending.can_accept());
        assert!(!ExchangeStatus::Accepted.can_accept());
        assert!(!ExchangeStatus::Rejected.can_accept());
        assert!(!ExchangeStatus::Cancelled.can_accept());
        assert!(!ExchangeStatus::Expired.can_accept());
    }

    #[test]
    fn test_exchange_status_can_reject() {
        assert!(ExchangeStatus::Pending.can_reject());
        assert!(!ExchangeStatus::Accepted.can_reject());
        assert!(!ExchangeStatus::Rejected.can_reject());
        assert!(!ExchangeStatus::Cancelled.can_reject());
        assert!(!ExchangeStatus::Expired.can_reject());
    }

    #[test]
    fn test_exchange_status_can_cancel() {
        assert!(ExchangeStatus::Pending.can_cancel());
        assert!(!ExchangeStatus::Accepted.can_cancel());
        assert!(!ExchangeStatus::Rejected.can_cancel());
        assert!(!ExchangeStatus::Cancelled.can_cancel());
        assert!(!ExchangeStatus::Expired.can_cancel());
    }

    #[test]
    fn test_exchange_direction_display() {
        assert_eq!(ExchangeDirection::Sent.to_string(), "sent");
        assert_eq!(ExchangeDirection::Received.to_string(), "received");
    }

    #[test]
    fn test_calculate_expiration_time() {
        let now = Utc::now();
        let expiration = calculate_expiration_time();
        let diff = expiration - now;
        
        // Should be approximately 72 hours (allow 1 second tolerance)
        assert!(diff.num_hours() >= 71 && diff.num_hours() <= 72);
    }

    #[test]
    fn test_exchange_price_info() {
        let card_id = Uuid::new_v4();
        
        // Base case: no popularity
        let price_info = ExchangePriceInfo::new(card_id, 10, 0, 0);
        assert_eq!(price_info.base_price, 10);
        assert_eq!(price_info.popularity_bonus, 0);
        assert_eq!(price_info.final_price, 10);

        // With likes only
        let price_info = ExchangePriceInfo::new(card_id, 10, 25, 0);
        assert_eq!(price_info.base_price, 10);
        assert_eq!(price_info.popularity_bonus, 2); // 25 / 10 = 2
        assert_eq!(price_info.final_price, 12);

        // With exchanges only
        let price_info = ExchangePriceInfo::new(card_id, 10, 0, 5);
        assert_eq!(price_info.base_price, 10);
        assert_eq!(price_info.popularity_bonus, 10); // 5 * 2 = 10
        assert_eq!(price_info.final_price, 20);

        // With both likes and exchanges
        let price_info = ExchangePriceInfo::new(card_id, 10, 50, 3);
        assert_eq!(price_info.base_price, 10);
        assert_eq!(price_info.popularity_bonus, 11); // (50 / 10) + (3 * 2) = 5 + 6 = 11
        assert_eq!(price_info.final_price, 21);
    }

    #[test]
    fn test_exchange_record_row_to_exchange_record() {
        let from_user_id = Uuid::new_v4();
        let to_user_id = Uuid::new_v4();
        let card_id = Uuid::new_v4();
        let now = Utc::now();

        let row = ExchangeRecordRow {
            id: Uuid::new_v4(),
            exchange_request_id: Some(Uuid::new_v4()),
            card_id,
            from_user_id,
            to_user_id,
            coin_amount: 15,
            completed_at: now,
        };

        // From sender's perspective
        let record = row.to_exchange_record(&from_user_id, None, None);
        assert_eq!(record.direction, ExchangeDirection::Sent);
        assert_eq!(record.counterparty_id, to_user_id);

        // From receiver's perspective
        let record = row.to_exchange_record(&to_user_id, None, None);
        assert_eq!(record.direction, ExchangeDirection::Received);
        assert_eq!(record.counterparty_id, from_user_id);
    }

    #[test]
    fn test_exchange_request_row_is_expired() {
        let row = ExchangeRequestRow {
            id: Uuid::new_v4(),
            requester_id: Uuid::new_v4(),
            card_id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            coin_amount: 10,
            status: ExchangeStatus::Pending,
            expires_at: Utc::now() - Duration::hours(1), // Expired 1 hour ago
            created_at: Utc::now() - Duration::hours(73),
            updated_at: Utc::now() - Duration::hours(73),
        };
        assert!(row.is_expired());

        let row = ExchangeRequestRow {
            id: Uuid::new_v4(),
            requester_id: Uuid::new_v4(),
            card_id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            coin_amount: 10,
            status: ExchangeStatus::Pending,
            expires_at: Utc::now() + Duration::hours(1), // Expires in 1 hour
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        assert!(!row.is_expired());
    }

    #[test]
    fn test_exchange_request_row_is_actionable() {
        // Pending and not expired - actionable
        let row = ExchangeRequestRow {
            id: Uuid::new_v4(),
            requester_id: Uuid::new_v4(),
            card_id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            coin_amount: 10,
            status: ExchangeStatus::Pending,
            expires_at: Utc::now() + Duration::hours(1),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        assert!(row.is_actionable());

        // Pending but expired - not actionable
        let row = ExchangeRequestRow {
            id: Uuid::new_v4(),
            requester_id: Uuid::new_v4(),
            card_id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            coin_amount: 10,
            status: ExchangeStatus::Pending,
            expires_at: Utc::now() - Duration::hours(1),
            created_at: Utc::now() - Duration::hours(73),
            updated_at: Utc::now() - Duration::hours(73),
        };
        assert!(!row.is_actionable());

        // Accepted - not actionable
        let row = ExchangeRequestRow {
            id: Uuid::new_v4(),
            requester_id: Uuid::new_v4(),
            card_id: Uuid::new_v4(),
            owner_id: Uuid::new_v4(),
            coin_amount: 10,
            status: ExchangeStatus::Accepted,
            expires_at: Utc::now() + Duration::hours(1),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        assert!(!row.is_actionable());
    }

    #[test]
    fn test_expiration_processing_result_all_successful() {
        // All successful
        let result = ExpirationProcessingResult {
            total_found: 5,
            processed_count: 5,
            failed_count: 0,
            total_refunded_amount: 100,
        };
        assert!(result.all_successful());

        // Some failures
        let result = ExpirationProcessingResult {
            total_found: 5,
            processed_count: 3,
            failed_count: 2,
            total_refunded_amount: 60,
        };
        assert!(!result.all_successful());

        // No requests found (still successful)
        let result = ExpirationProcessingResult {
            total_found: 0,
            processed_count: 0,
            failed_count: 0,
            total_refunded_amount: 0,
        };
        assert!(result.all_successful());
    }

    #[test]
    fn test_expiration_processing_result_has_processed() {
        // Has processed
        let result = ExpirationProcessingResult {
            total_found: 5,
            processed_count: 3,
            failed_count: 2,
            total_refunded_amount: 60,
        };
        assert!(result.has_processed());

        // None processed
        let result = ExpirationProcessingResult {
            total_found: 5,
            processed_count: 0,
            failed_count: 5,
            total_refunded_amount: 0,
        };
        assert!(!result.has_processed());

        // No requests found
        let result = ExpirationProcessingResult {
            total_found: 0,
            processed_count: 0,
            failed_count: 0,
            total_refunded_amount: 0,
        };
        assert!(!result.has_processed());
    }
}
