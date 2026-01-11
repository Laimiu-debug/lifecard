//! Life Card API - Main entry point
//!
//! Requirements: 10.1-10.8

use std::net::SocketAddr;
use std::time::Duration;

use axum::{
    middleware,
    routing::{delete, get, post, put},
    Router,
};
use tower_http::{
    cors::{Any, CorsLayer},
    limit::RequestBodyLimitLayer,
    services::ServeDir,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use life_card_api::config::Config;
use life_card_api::db::postgres::create_pool;
use life_card_api::handlers::{auth, card, exchange, notification, upload, user};
use life_card_api::middleware::auth::{auth_middleware, optional_auth_middleware, AppState};
use life_card_api::tasks::exchange_expiration::spawn_exchange_expiration_task;
async fn health_check() -> &'static str {
    "OK"
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,life_card_api=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = Config::from_env().expect("Failed to load configuration");

    tracing::info!("Starting {} in {} mode", config.app_name, config.app_env);

    // Create database connection pool
    let pool = create_pool(&config).await?;
    tracing::info!("Database connection pool created");

    // Create application state
    let app_state = AppState {
        pool: pool.clone(),
        config: config.clone(),
    };

    // Spawn background task for processing expired exchange requests
    let expiration_task_shutdown = spawn_exchange_expiration_task(pool.clone(), config.clone());
    tracing::info!("Exchange expiration background task started");

    // Build router
    let app = create_router(app_state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.app_port));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // Run server with graceful shutdown
    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to install CTRL+C signal handler");
            
            tracing::info!("Shutdown signal received, stopping background tasks...");
            let _ = expiration_task_shutdown.send(true);
        })
        .await?;

    tracing::info!("Server shutdown complete");
    Ok(())
}

/// Create the main application router
fn create_router(state: AppState) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any)
        .max_age(Duration::from_secs(3600));

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/wechat-login", post(auth::wechat_login))
        .route("/api/auth/forgot-password", post(auth::forgot_password));

    // Routes with optional authentication
    let optional_auth_routes = Router::new()
        .route("/api/cards/search", get(card::search_cards))
        .route("/api/cards/hot", get(card::get_hot_cards))
        .route("/api/cards/random", get(card::get_random_cards))
        .route("/api/cards/:card_id", get(card::get_card))
        .route("/api/cards/:card_id/comments", get(card::get_comments))
        .route("/api/users/:user_id", get(user::get_user_profile))
        .route("/api/users/:user_id/cards", get(card::get_user_cards))
        .route("/api/users/:user_id/followers", get(user::get_followers))
        .route("/api/users/:user_id/following", get(user::get_following))
        .layer(middleware::from_fn_with_state(state.clone(), optional_auth_middleware));

    // Protected routes (authentication required)
    let protected_routes = Router::new()
        // Upload routes
        .route("/api/upload/avatar", post(upload::upload_avatar))
        .route("/api/upload/card_media", post(upload::upload_card_media))
        // User profile routes
        .route("/api/users/me", get(user::get_my_profile).put(user::update_my_profile))
        .route("/api/users/me/interest-tags", get(user::get_interest_tags).put(user::set_interest_tags))
        .route("/api/users/me/avatar", put(user::upload_avatar))
        .route("/api/users/me/coins", get(user::get_coin_balance))
        .route("/api/users/me/coins/history", get(user::get_coin_history))
        .route("/api/users/:user_id/follow", post(user::follow_user).delete(user::unfollow_user))
        .route("/api/users/:user_id/is-following", get(user::is_following))
        // Notification routes
        .route("/api/notifications/unread-count", get(notification::get_unread_count))
        // Card CRUD routes
        .route("/api/cards", post(card::create_card))
        .route("/api/cards/feed", get(card::get_feed))
        .route("/api/cards/my-cards", get(card::get_my_cards))
        .route("/api/cards/collected", get(card::get_collected_cards))
        .route("/api/cards/timeline", get(card::get_timeline))
        .route("/api/cards/by-category", get(card::get_cards_by_category))
        .route("/api/cards/:card_id", put(card::update_card).delete(card::delete_card))
        .route("/api/cards/:card_id/privacy", put(card::update_privacy))
        .route("/api/cards/:card_id/folder", put(card::move_to_folder))
        .route("/api/cards/:card_id/like", post(card::like_card).delete(card::unlike_card))
        .route("/api/cards/:card_id/comments", post(card::add_comment))
        .route("/api/cards/comments/:comment_id", delete(card::delete_comment))
        // Folder routes
        .route("/api/cards/folders", get(card::get_folders).post(card::create_folder))
        .route("/api/cards/folders/:folder_id", put(card::rename_folder).delete(card::delete_folder))
        .route("/api/cards/folders/:folder_id/cards", get(card::get_folder_cards))
        // Exchange routes
        .route("/api/exchanges", post(exchange::create_exchange_request))
        .route("/api/exchanges/pending", get(exchange::get_pending_requests))
        .route("/api/exchanges/sent", get(exchange::get_sent_requests))
        .route("/api/exchanges/history", get(exchange::get_exchange_history))
        .route("/api/exchanges/price/:card_id", get(exchange::get_exchange_price))
        .route("/api/exchanges/:exchange_id/accept", post(exchange::accept_exchange))
        .route("/api/exchanges/:exchange_id/reject", post(exchange::reject_exchange))
        .route("/api/exchanges/:exchange_id/cancel", post(exchange::cancel_exchange))
        .layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    // Combine all routes
    Router::new()
        .merge(public_routes)
        .merge(optional_auth_routes)
        .merge(protected_routes)
        // Serve uploaded files as static files
        .nest_service("/uploads", ServeDir::new("uploads"))
        .layer(RequestBodyLimitLayer::new(50 * 1024 * 1024)) // 50MB limit for file uploads
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}
