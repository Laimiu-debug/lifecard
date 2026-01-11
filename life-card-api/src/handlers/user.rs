//! User handlers for profile management and social features
//!
//! Requirements: 2.1-2.7, 8.5-8.7

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::{AppState, AuthUserExtractor, OptionalAuthUserExtractor};
use crate::models::common::{ApiResponse, Pagination};
use crate::models::user::{ProfileUpdateData, SetInterestTagsRequest};
use crate::services::user_service::UserService;

/// Get current user's profile
/// 
/// GET /api/users/me
/// 
/// Requirements: 2.1, 2.4
/// 
/// Response:
/// - 200 OK: Returns UserProfile
/// - 401 Unauthorized: Not authenticated
pub async fn get_my_profile(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let profile = user_service.get_profile(&auth.user_id).await?;

    Ok(Json(ApiResponse::success(profile)))
}

/// Update current user's profile
/// 
/// PUT /api/users/me
/// 
/// Requirements: 2.1, 2.2, 2.3
/// 
/// Request body:
/// ```json
/// {
///     "nickname": "New Nickname",
///     "bio": "My bio",
///     "age_range": "25-30",
///     "location": "Beijing, China"
/// }
/// ```
/// 
/// Response:
/// - 200 OK: Returns updated UserProfile
/// - 400 Bad Request: Validation error
/// - 401 Unauthorized: Not authenticated
pub async fn update_my_profile(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<ProfileUpdateData>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let profile = user_service
        .update_profile(&auth.user_id, payload)
        .await?;

    Ok(Json(ApiResponse::success(profile)))
}

/// Set current user's interest tags
/// 
/// PUT /api/users/me/interest-tags
/// 
/// Requirements: 2.3
/// 
/// Request body:
/// ```json
/// {
///     "tags": ["旅行", "职业", "情感", "成就"]
/// }
/// ```
/// 
/// Response:
/// - 200 OK: Success message
/// - 400 Bad Request: Validation error
/// - 401 Unauthorized: Not authenticated
pub async fn set_interest_tags(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<SetInterestTagsRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    user_service
        .set_interest_tags(&auth.user_id, payload.tags)
        .await?;

    Ok(Json(ApiResponse::<()>::ok_with_message("Interest tags updated")))
}

/// Get current user's interest tags
/// 
/// GET /api/users/me/interest-tags
/// 
/// Requirements: 2.3
/// 
/// Response:
/// - 200 OK: Returns list of tags
/// - 401 Unauthorized: Not authenticated
pub async fn get_interest_tags(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let tags = user_service.get_interest_tags(&auth.user_id).await?;

    Ok(Json(ApiResponse::success(tags)))
}

/// Upload avatar URL
/// 
/// PUT /api/users/me/avatar
/// 
/// Requirements: 2.2
/// 
/// Request body:
/// ```json
/// {
///     "avatar_url": "https://example.com/avatar.jpg"
/// }
/// ```
/// 
/// Response:
/// - 200 OK: Returns the avatar URL
/// - 400 Bad Request: Invalid URL
/// - 401 Unauthorized: Not authenticated
#[derive(Debug, Serialize, Deserialize)]
pub struct UploadAvatarRequest {
    pub avatar_url: String,
}

pub async fn upload_avatar(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Json(payload): Json<UploadAvatarRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let avatar_url = user_service
        .upload_avatar(&auth.user_id, &payload.avatar_url)
        .await?;

    Ok(Json(ApiResponse::success(avatar_url)))
}

/// Get another user's public profile
/// 
/// GET /api/users/:user_id
/// 
/// Requirements: 2.5, 2.6
/// 
/// Response:
/// - 200 OK: Returns UserProfile (public info only)
/// - 404 Not Found: User not found
pub async fn get_user_profile(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    auth: OptionalAuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let viewer_id = auth.as_ref().map(|a| &a.user_id);
    let profile = user_service
        .get_public_profile(&user_id, viewer_id)
        .await?;

    Ok(Json(ApiResponse::success(profile)))
}

/// Get current user's coin balance
/// 
/// GET /api/users/me/coins
/// 
/// Requirements: 2.4, 6.4
/// 
/// Response:
/// - 200 OK: Returns coin balance
/// - 401 Unauthorized: Not authenticated
#[derive(Debug, Serialize, Deserialize)]
pub struct CoinBalanceResponse {
    pub balance: i32,
}

pub async fn get_coin_balance(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let balance = user_service.get_coin_balance(&auth.user_id).await?;

    Ok(Json(ApiResponse::success(CoinBalanceResponse { balance })))
}

/// Get current user's coin transaction history
/// 
/// GET /api/users/me/coins/history
/// 
/// Requirements: 6.5
/// 
/// Query parameters:
/// - page: Page number (default: 1)
/// - page_size: Items per page (default: 20, max: 100)
/// 
/// Response:
/// - 200 OK: Returns paginated coin transactions
/// - 401 Unauthorized: Not authenticated
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

pub async fn get_coin_history(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let history = user_service
        .get_coin_history(&auth.user_id, query.into())
        .await?;

    Ok(Json(ApiResponse::success(history)))
}

/// Follow a user
/// 
/// POST /api/users/:user_id/follow
/// 
/// Requirements: 8.5
/// 
/// Response:
/// - 200 OK: Success message
/// - 400 Bad Request: Cannot follow yourself or already following
/// - 401 Unauthorized: Not authenticated
/// - 404 Not Found: User not found
pub async fn follow_user(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    user_service
        .follow_user(&auth.user_id, &user_id)
        .await?;

    Ok(Json(ApiResponse::<()>::ok_with_message("Successfully followed user")))
}

/// Unfollow a user
/// 
/// DELETE /api/users/:user_id/follow
/// 
/// Requirements: 8.6
/// 
/// Response:
/// - 200 OK: Success message
/// - 400 Bad Request: Not following this user
/// - 401 Unauthorized: Not authenticated
pub async fn unfollow_user(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    user_service
        .unfollow_user(&auth.user_id, &user_id)
        .await?;

    Ok(Json(ApiResponse::<()>::ok_with_message("Successfully unfollowed user")))
}

/// Get a user's followers
/// 
/// GET /api/users/:user_id/followers
/// 
/// Requirements: 8.7
/// 
/// Query parameters:
/// - page: Page number (default: 1)
/// - page_size: Items per page (default: 20, max: 100)
/// 
/// Response:
/// - 200 OK: Returns paginated list of followers
/// - 404 Not Found: User not found
pub async fn get_followers(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let followers = user_service
        .get_followers(&user_id, query.into())
        .await?;

    Ok(Json(ApiResponse::success(followers)))
}

/// Get users that a user is following
/// 
/// GET /api/users/:user_id/following
/// 
/// Requirements: 8.7
/// 
/// Query parameters:
/// - page: Page number (default: 1)
/// - page_size: Items per page (default: 20, max: 100)
/// 
/// Response:
/// - 200 OK: Returns paginated list of following
/// - 404 Not Found: User not found
pub async fn get_following(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Query(query): Query<PaginationQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let following = user_service
        .get_following(&user_id, query.into())
        .await?;

    Ok(Json(ApiResponse::success(following)))
}

/// Check if current user is following another user
/// 
/// GET /api/users/:user_id/is-following
/// 
/// Requirements: 8.5
/// 
/// Response:
/// - 200 OK: Returns { is_following: bool }
/// - 401 Unauthorized: Not authenticated
#[derive(Debug, Serialize)]
pub struct IsFollowingResponse {
    pub is_following: bool,
}

pub async fn is_following(
    State(state): State<AppState>,
    auth: AuthUserExtractor,
    Path(user_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let is_following = user_service
        .is_following(&auth.user_id, &user_id)
        .await?;

    Ok(Json(ApiResponse::success(IsFollowingResponse { is_following })))
}
