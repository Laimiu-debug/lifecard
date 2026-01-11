use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

/// JWT claims structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Issued at (Unix timestamp)
    pub iat: i64,
}

impl Claims {
    /// Create new claims for a user
    pub fn new(user_id: Uuid, expiration_hours: i64) -> Self {
        let now = Utc::now();
        let exp = now + Duration::hours(expiration_hours);
        
        Self {
            sub: user_id.to_string(),
            exp: exp.timestamp(),
            iat: now.timestamp(),
        }
    }

    /// Get the user ID from claims
    pub fn user_id(&self) -> Result<Uuid, AppError> {
        Uuid::parse_str(&self.sub)
            .map_err(|_| AppError::Unauthorized)
    }
}

/// Generate a JWT token for a user
pub fn generate_token(user_id: Uuid, secret: &str, expiration_hours: i64) -> Result<String, AppError> {
    let claims = Claims::new(user_id, expiration_hours);
    
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("Token generation failed: {}", e)))
}

/// Validate and decode a JWT token
pub fn validate_token(token: &str, secret: &str) -> Result<TokenData<Claims>, AppError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| {
        tracing::debug!("Token validation failed: {}", e);
        AppError::Unauthorized
    })
}

/// Extract user ID from a valid token
pub fn extract_user_id(token: &str, secret: &str) -> Result<Uuid, AppError> {
    let token_data = validate_token(token, secret)?;
    token_data.claims.user_id()
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &str = "test_secret_key_for_jwt_testing";

    #[test]
    fn test_generate_and_validate_token() {
        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, TEST_SECRET, 24).expect("Token generation should succeed");
        
        let token_data = validate_token(&token, TEST_SECRET).expect("Token validation should succeed");
        
        assert_eq!(token_data.claims.sub, user_id.to_string());
    }

    #[test]
    fn test_extract_user_id() {
        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, TEST_SECRET, 24).expect("Token generation should succeed");
        
        let extracted_id = extract_user_id(&token, TEST_SECRET).expect("User ID extraction should succeed");
        
        assert_eq!(extracted_id, user_id);
    }

    #[test]
    fn test_invalid_token_fails_validation() {
        let result = validate_token("invalid_token", TEST_SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_secret_fails_validation() {
        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, TEST_SECRET, 24).expect("Token generation should succeed");
        
        let result = validate_token(&token, "wrong_secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_claims_expiration() {
        let user_id = Uuid::new_v4();
        let claims = Claims::new(user_id, 24);
        
        let now = Utc::now().timestamp();
        
        // Expiration should be approximately 24 hours from now
        assert!(claims.exp > now);
        assert!(claims.exp <= now + 24 * 60 * 60 + 1); // Allow 1 second tolerance
        
        // Issued at should be approximately now
        assert!(claims.iat >= now - 1);
        assert!(claims.iat <= now + 1);
    }
}
