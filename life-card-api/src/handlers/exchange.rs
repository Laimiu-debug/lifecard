//! Exchange handlers for card exchange operations
//!
//! Requirements: 5.1-5.9, 6.1-6.7

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::{AppState, AuthUserExtractor};
use crate::models::common::{ApiResponse, Pagination};
use crate::models::exchange::CreateExchangeRequestData;
use crate::services::exchange_service::ExchangeService;

// Query Parameters
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: i32,
    #[serde(default = "default_page_size")]
    pub page_size: i32,
}

fn default_page() -> i32 { 1 }
fn default_page_size() -> i32 { 20 }

impl From<PaginationQuery> for Pagination {
    fn from(query: PaginationQuery) -> Self {
        Pagination::new(query.page, query.page_size)
    }
}

// Exchange Request Handlers

/// Create an exchange request
/// 
/// POST /api/exchanges
/// 
/// Requirements: 5.1, 5.2
/// 
/// Request body:
/// ```json
/// {
///     "card_id": "uuid"
/// }
/// ```
pub async fn create_exchange_request(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<CreateExchangeRequestData>,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    let request = exchange_service
        .create_exchange_request(&auth.user_id, &payload.card_id)
        .await?;

    Ok((StatusCode::CREATED, Json(ApiResponse::success(request))))
}

/// Accept an exchange request
/// 
/// POST /api/exchanges/:exchange_id/accept
/// 
/// Requirements: 5.3
pub async fn accept_exchange(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(exchange_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    let result = exchange_service
        .accept_exchange(&exchange_id, &auth.user_id)
        .await?;

    Ok(Json(ApiResponse::success(result)))
}

/// Reject an exchange request
/// 
/// POST /api/exchanges/:exchange_id/reject
/// 
/// Requirements: 5.4
pub async fn reject_exchange(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(exchange_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    exchange_service
        .reject_exchange(&exchange_id, &auth.user_id)
        .await?;

    Ok(Json(ApiResponse::<()>::ok_with_message("Exchange request rejected")))
}

/// Cancel an exchange request (by requester)
/// 
/// POST /api/exchanges/:exchange_id/cancel
/// 
/// Requirements: 5.4
pub async fn cancel_exchange(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(exchange_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    exchange_service
        .cancel_exchange(&exchange_id, &auth.user_id)
        .await?;

    Ok(Json(ApiResponse::<()>::ok_with_message("Exchange request cancelled")))
}

// Exchange Query Handlers

/// Get pending exchange requests (received as card owner)
/// 
/// GET /api/exchanges/pending
/// 
/// Requirements: 5.6, 5.7
pub async fn get_pending_requests(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    let requests = exchange_service
        .get_pending_requests(&auth.user_id)
        .await?;

    Ok(Json(ApiResponse::success(requests)))
}

/// Get sent exchange requests (as requester)
/// 
/// GET /api/exchanges/sent
/// 
/// Requirements: 5.6, 5.7
pub async fn get_sent_requests(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    let requests = exchange_service
        .get_sent_requests(&auth.user_id)
        .await?;

    Ok(Json(ApiResponse::success(requests)))
}

/// Get exchange history (completed exchanges)
/// 
/// GET /api/exchanges/history
/// 
/// Requirements: 5.6, 5.7
pub async fn get_exchange_history(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    let history = exchange_service
        .get_exchange_history(&auth.user_id, query.into())
        .await?;

    Ok(Json(ApiResponse::success(history)))
}

// Price Calculation Handler

/// Calculate exchange price for a card
/// 
/// GET /api/exchanges/price/:card_id
/// 
/// Requirements: 6.7
pub async fn get_exchange_price(
    State(state): State<AppState>,
    _auth: AuthUserExtractor,
    Path(card_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let exchange_service = ExchangeService::new(state.pool.clone(), state.config.clone());
    
    let price_info = exchange_service
        .calculate_exchange_price(&card_id)
        .await?;

    Ok(Json(ApiResponse::success(price_info)))
}
