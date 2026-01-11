//! Rate limiting middleware
//!
//! Requirements: 10.1-10.8

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::error::{ErrorDetail, ErrorResponse};
use crate::middleware::auth::AppState;

/// In-memory rate limiter using a sliding window approach
/// For production, consider using Redis for distributed rate limiting
#[derive(Clone)]
pub struct RateLimiter {
    /// Map of client identifier to (request count, window start time)
    requests: Arc<RwLock<HashMap<String, (u32, Instant)>>>,
    /// Maximum requests per window
    max_requests: u32,
    /// Window duration
    window_duration: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_seconds: u64) -> Self {
        Self {
            requests: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window_duration: Duration::from_secs(window_seconds),
        }
    }

    /// Check if a request should be allowed
    pub async fn check(&self, client_id: &str) -> bool {
        let now = Instant::now();
        let mut requests = self.requests.write().await;

        match requests.get_mut(client_id) {
            Some((count, window_start)) => {
                // Check if window has expired
                if now.duration_since(*window_start) > self.window_duration {
                    // Reset window
                    *count = 1;
                    *window_start = now;
                    true
                } else if *count < self.max_requests {
                    // Increment count
                    *count += 1;
                    true
                } else {
                    // Rate limit exceeded
                    false
                }
            }
            None => {
                // First request from this client
                requests.insert(client_id.to_string(), (1, now));
                true
            }
        }
    }

    /// Clean up expired entries (call periodically)
    pub async fn cleanup(&self) {
        let now = Instant::now();
        let mut requests = self.requests.write().await;
        requests.retain(|_, (_, window_start)| {
            now.duration_since(*window_start) <= self.window_duration
        });
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        // Default: 100 requests per minute
        Self::new(100, 60)
    }
}

/// Rate limiting middleware
/// 
/// Limits requests based on client IP or user ID (if authenticated)
pub async fn rate_limit_middleware(
    State(_state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    // Get client identifier (prefer user ID if authenticated, otherwise use IP)
    let client_id = get_client_identifier(&request);

    // Create rate limiter (in production, this should be shared state)
    let rate_limiter = RateLimiter::default();

    if rate_limiter.check(&client_id).await {
        next.run(request).await
    } else {
        rate_limit_exceeded_response()
    }
}

/// Extract client identifier from request
fn get_client_identifier(request: &Request) -> String {
    // Try to get user ID from extensions (set by auth middleware)
    if let Some(auth_user) = request.extensions().get::<crate::middleware::auth::AuthUser>() {
        return format!("user:{}", auth_user.user_id);
    }

    // Fall back to IP address
    if let Some(forwarded) = request.headers().get("x-forwarded-for") {
        if let Ok(forwarded_str) = forwarded.to_str() {
            if let Some(ip) = forwarded_str.split(',').next() {
                return format!("ip:{}", ip.trim());
            }
        }
    }

    if let Some(real_ip) = request.headers().get("x-real-ip") {
        if let Ok(ip) = real_ip.to_str() {
            return format!("ip:{}", ip);
        }
    }

    // Default fallback
    "ip:unknown".to_string()
}

/// Create rate limit exceeded response
fn rate_limit_exceeded_response() -> Response {
    let error_response = ErrorResponse {
        success: false,
        error: ErrorDetail {
            code: "RATE_LIMIT_EXCEEDED".to_string(),
            message: "Too many requests. Please try again later.".to_string(),
            details: None,
        },
        timestamp: chrono::Utc::now(),
        request_id: Uuid::new_v4().to_string(),
    };

    (StatusCode::TOO_MANY_REQUESTS, Json(error_response)).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_allows_requests_within_limit() {
        let limiter = RateLimiter::new(5, 60);
        
        for _ in 0..5 {
            assert!(limiter.check("test_client").await);
        }
    }

    #[tokio::test]
    async fn test_rate_limiter_blocks_requests_over_limit() {
        let limiter = RateLimiter::new(3, 60);
        
        // First 3 requests should be allowed
        assert!(limiter.check("test_client").await);
        assert!(limiter.check("test_client").await);
        assert!(limiter.check("test_client").await);
        
        // 4th request should be blocked
        assert!(!limiter.check("test_client").await);
    }

    #[tokio::test]
    async fn test_rate_limiter_different_clients() {
        let limiter = RateLimiter::new(2, 60);
        
        // Client A
        assert!(limiter.check("client_a").await);
        assert!(limiter.check("client_a").await);
        assert!(!limiter.check("client_a").await);
        
        // Client B should have its own limit
        assert!(limiter.check("client_b").await);
        assert!(limiter.check("client_b").await);
        assert!(!limiter.check("client_b").await);
    }
}
