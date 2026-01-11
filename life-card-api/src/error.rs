use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub error: ErrorDetail,
    pub timestamp: DateTime<Utc>,
    pub request_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<HashMap<String, Vec<String>>>,
}

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

    #[error("External service error: {0}")]
    ExternalService(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR", msg.clone()),
            AppError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "Authentication required".to_string(),
            ),
            AppError::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "Access denied".to_string(),
            ),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::BusinessLogic(msg) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "BUSINESS_ERROR", msg.clone())
            }
            AppError::ExternalService(msg) => {
                (StatusCode::BAD_GATEWAY, "EXTERNAL_SERVICE_ERROR", msg.clone())
            }
            AppError::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                "Database error".to_string(),
            ),
            AppError::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Internal server error".to_string(),
            ),
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
