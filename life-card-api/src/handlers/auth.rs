//! Authentication handlers for user registration and login
//!
//! Requirements: 1.1-1.7

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;
use crate::middleware::auth::AppState;
use crate::models::common::ApiResponse;
use crate::models::user::{LoginRequest, RegisterRequest, UserProfile};
use crate::services::user_service::UserService;
use crate::utils::jwt;

/// WeChat login request
#[derive(Debug, Serialize, Deserialize)]
pub struct WechatLoginRequest {
    pub code: String,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
}

/// WeChat code2session response
#[derive(Debug, Deserialize)]
struct WechatSessionResponse {
    openid: Option<String>,
    session_key: Option<String>,
    errcode: Option<i32>,
    errmsg: Option<String>,
}

/// WeChat login result
#[derive(Debug, Serialize)]
pub struct WechatAuthResult {
    pub token: String,
    pub user: UserProfile,
    pub is_new_user: bool,
}

/// WeChat login handler
/// 
/// POST /api/auth/wechat-login
/// 
/// Requirements: 1.1, 1.2, 1.3
pub async fn wechat_login(
    State(state): State<AppState>,
    Json(payload): Json<WechatLoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    // 1. Call WeChat API to get openid
    let openid = get_wechat_openid(
        &payload.code,
        &state.config.wechat_app_id,
        &state.config.wechat_app_secret,
    ).await?;

    // 2. Find or create user by openid
    let (user, is_new_user) = find_or_create_wechat_user(
        &state.pool,
        &state.config,
        &openid,
        payload.nickname.as_deref(),
        payload.avatar_url.as_deref(),
    ).await?;

    // 3. Generate JWT token
    let token = jwt::generate_token(user.id, &state.config.jwt_secret, state.config.jwt_expiration_hours)?;

    // 4. Get user profile with interest tags
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    let user_profile = user_service.get_profile(&user.id).await?;

    Ok(Json(ApiResponse::success(WechatAuthResult {
        token,
        user: user_profile,
        is_new_user,
    })))
}

/// Get WeChat openid from code
async fn get_wechat_openid(
    code: &str,
    app_id: &str,
    app_secret: &str,
) -> Result<String, AppError> {
    let url = format!(
        "https://api.weixin.qq.com/sns/jscode2session?appid={}&secret={}&js_code={}&grant_type=authorization_code",
        app_id, app_secret, code
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::ExternalService(format!("WeChat API request failed: {}", e)))?;

    let session: WechatSessionResponse = response
        .json::<WechatSessionResponse>()
        .await
        .map_err(|e| AppError::ExternalService(format!("Failed to parse WeChat response: {}", e)))?;

    if let Some(errcode) = session.errcode {
        if errcode != 0 {
            return Err(AppError::ExternalService(format!(
                "WeChat API error: {} - {}",
                errcode,
                session.errmsg.unwrap_or_default()
            )));
        }
    }

    session.openid.ok_or_else(|| {
        AppError::ExternalService("WeChat API did not return openid".to_string())
    })
}

/// User model for database operations
#[derive(Debug, sqlx::FromRow)]
struct User {
    id: Uuid,
    wechat_openid: Option<String>,
    nickname: String,
    avatar_url: Option<String>,
}

/// Find or create user by WeChat openid
async fn find_or_create_wechat_user(
    pool: &PgPool,
    config: &Config,
    openid: &str,
    nickname: Option<&str>,
    avatar_url: Option<&str>,
) -> Result<(User, bool), AppError> {
    // Try to find existing user
    let existing_user = sqlx::query_as::<_, User>(
        "SELECT id, wechat_openid, nickname, avatar_url FROM users WHERE wechat_openid = $1"
    )
    .bind(openid)
    .fetch_optional(pool)
    .await?;

    if let Some(mut user) = existing_user {
        // Update nickname and avatar if provided
        if nickname.is_some() || avatar_url.is_some() {
            let new_nickname = nickname.unwrap_or(&user.nickname);
            let new_avatar = avatar_url.or(user.avatar_url.as_deref());
            
            sqlx::query(
                "UPDATE users SET nickname = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3"
            )
            .bind(new_nickname)
            .bind(new_avatar)
            .bind(user.id)
            .execute(pool)
            .await?;

            user.nickname = new_nickname.to_string();
            user.avatar_url = new_avatar.map(|s| s.to_string());
        }
        
        return Ok((user, false));
    }

    // Create new user
    let user_id = Uuid::new_v4();
    let default_nickname = match nickname {
        Some(n) => n.to_string(),
        None => format!("用户{}", &openid[..6.min(openid.len())]),
    };
    
    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, wechat_openid, nickname, avatar_url, coin_balance, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, wechat_openid, nickname, avatar_url
        "#
    )
    .bind(user_id)
    .bind(openid)
    .bind(&default_nickname)
    .bind(avatar_url)
    .bind(config.default_coin_balance)
    .fetch_one(pool)
    .await?;

    Ok((user, true))
}

/// Register a new user
/// 
/// POST /api/auth/register
/// 
/// Requirements: 1.1, 1.2, 1.3, 1.7
/// 
/// Request body:
/// ```json
/// {
///     "email": "user@example.com",
///     "password": "securepassword123"
/// }
/// ```
/// 
/// Response:
/// - 201 Created: Returns AuthResult with token and user profile
/// - 400 Bad Request: Invalid email format or password too short
/// - 400 Bad Request: Email already registered
pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let auth_result = user_service
        .register(&payload.email, &payload.password)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(auth_result)),
    ))
}

/// Login with email and password
/// 
/// POST /api/auth/login
/// 
/// Requirements: 1.4, 1.5
/// 
/// Request body:
/// ```json
/// {
///     "email": "user@example.com",
///     "password": "securepassword123"
/// }
/// ```
/// 
/// Response:
/// - 200 OK: Returns AuthResult with token and user profile
/// - 400 Bad Request: Invalid email format
/// - 401 Unauthorized: Invalid credentials
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_service = UserService::new(state.pool.clone(), state.config.clone());
    
    let auth_result = user_service
        .login(&payload.email, &payload.password)
        .await?;

    Ok(Json(ApiResponse::success(auth_result)))
}

/// Refresh token endpoint (placeholder for future implementation)
/// 
/// POST /api/auth/refresh
/// 
/// Requirements: 1.4
#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

pub async fn refresh_token(
    State(_state): State<AppState>,
    Json(_payload): Json<RefreshTokenRequest>,
) -> Result<Json<ApiResponse<()>>, AppError> {
    // TODO: Implement refresh token logic
    Err(AppError::BusinessLogic("Refresh token not implemented yet".to_string()))
}

/// Request password reset
/// 
/// POST /api/auth/forgot-password
/// 
/// Requirements: 1.6
#[derive(Debug, Serialize, Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

pub async fn forgot_password(
    State(_state): State<AppState>,
    Json(_payload): Json<ForgotPasswordRequest>,
) -> Result<impl IntoResponse, AppError> {
    // TODO: Implement password reset email sending
    // For MVP, we'll return a success message without actually sending email
    Ok(Json(ApiResponse::<()>::ok_with_message(
        "If the email exists, a password reset link will be sent",
    )))
}
