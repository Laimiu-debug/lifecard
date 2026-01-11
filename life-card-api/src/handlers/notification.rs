//! Notification handlers (placeholder implementation)
//!
//! Requirements: 10.1-10.4

use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use serde::Serialize;

use crate::error::AppError;
use crate::middleware::auth::{AppState, AuthUserExtractor};
use crate::models::common::ApiResponse;

/// Unread count response
#[derive(Debug, Serialize)]
pub struct UnreadCountResponse {
    pub total: i32,
    pub likes: i32,
    pub comments: i32,
    pub exchanges: i32,
    pub system: i32,
}

/// Get unread notification count - GET /api/notifications/unread-count
pub async fn get_unread_count(
    State(_state): State<AppState>,
    _auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    // Placeholder: return zero counts
    Ok(Json(ApiResponse::success(UnreadCountResponse {
        total: 0,
        likes: 0,
        comments: 0,
        exchanges: 0,
        system: 0,
    })))
}
