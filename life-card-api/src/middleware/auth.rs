//! Authentication middleware for JWT validation
//!
//! Requirements: 1.4, 10.3

use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use uuid::Uuid;

use crate::error::{AppError, ErrorDetail, ErrorResponse};
use crate::utils::jwt;

/// Application state containing JWT secret and other shared resources
#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub config: crate::config::Config,
}

/// Authenticated user information extracted from JWT token
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
}

/// Extension trait for extracting auth user from request extensions
impl AuthUser {
    pub fn new(user_id: Uuid) -> Self {
        Self { user_id }
    }
}

/// Authentication middleware that validates JWT tokens
/// 
/// This middleware:
/// 1. Extracts the Authorization header from the request
/// 2. Validates the Bearer token format
/// 3. Validates the JWT token using the configured secret
/// 4. Extracts the user ID from the token claims
/// 5. Inserts the AuthUser into request extensions for downstream handlers
///
/// Requirements: 1.4, 10.3
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    // Extract Authorization header
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return unauthorized_response("Missing or invalid Authorization header");
        }
    };

    // Validate token and extract user ID
    match jwt::extract_user_id(token, &state.config.jwt_secret) {
        Ok(user_id) => {
            // Insert AuthUser into request extensions
            request.extensions_mut().insert(AuthUser::new(user_id));
            next.run(request).await
        }
        Err(_) => {
            unauthorized_response("Invalid or expired token")
        }
    }
}

/// Optional authentication middleware that doesn't fail on missing token
/// 
/// This middleware:
/// 1. Attempts to extract and validate the JWT token
/// 2. If successful, inserts AuthUser into request extensions
/// 3. If no token or invalid token, continues without AuthUser
///
/// Useful for endpoints that have different behavior for authenticated vs anonymous users
pub async fn optional_auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    // Extract Authorization header
    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    if let Some(header) = auth_header {
        if header.starts_with("Bearer ") {
            let token = &header[7..];
            // Try to validate token and extract user ID
            if let Ok(user_id) = jwt::extract_user_id(token, &state.config.jwt_secret) {
                request.extensions_mut().insert(AuthUser::new(user_id));
            }
        }
    }

    next.run(request).await
}

/// Helper function to create an unauthorized response
fn unauthorized_response(message: &str) -> Response {
    let error_response = ErrorResponse {
        success: false,
        error: ErrorDetail {
            code: "UNAUTHORIZED".to_string(),
            message: message.to_string(),
            details: None,
        },
        timestamp: chrono::Utc::now(),
        request_id: Uuid::new_v4().to_string(),
    };

    (StatusCode::UNAUTHORIZED, Json(error_response)).into_response()
}

/// Extractor for getting the authenticated user from request extensions
/// 
/// Usage in handlers:
/// ```ignore
/// async fn my_handler(auth: AuthUserExtractor) -> impl IntoResponse {
///     let user_id = auth.user_id;
///     // ...
/// }
/// ```
#[derive(Debug, Clone)]
pub struct AuthUserExtractor(pub AuthUser);

impl std::ops::Deref for AuthUserExtractor {
    type Target = AuthUser;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for AuthUserExtractor
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthUser>()
            .cloned()
            .map(AuthUserExtractor)
            .ok_or(AppError::Unauthorized)
    }
}

/// Optional auth user extractor - returns None if not authenticated
#[derive(Debug, Clone)]
pub struct OptionalAuthUserExtractor(pub Option<AuthUser>);

impl std::ops::Deref for OptionalAuthUserExtractor {
    type Target = Option<AuthUser>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[axum::async_trait]
impl<S> axum::extract::FromRequestParts<S> for OptionalAuthUserExtractor
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        _state: &S,
    ) -> Result<Self, Self::Rejection> {
        Ok(OptionalAuthUserExtractor(
            parts.extensions.get::<AuthUser>().cloned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_user_creation() {
        let user_id = Uuid::new_v4();
        let auth_user = AuthUser::new(user_id);
        assert_eq!(auth_user.user_id, user_id);
    }
}
