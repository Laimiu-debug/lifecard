use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

use crate::error::AppError;

/// Hash a password using Argon2id
pub fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hashing failed: {}", e)))
}

/// Verify a password against a hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid password hash format: {}", e)))?;
    
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify_password() {
        let password = "secure_password_123";
        let hash = hash_password(password).expect("Hashing should succeed");
        
        // Hash should not be the same as password
        assert_ne!(hash, password);
        
        // Verification should succeed with correct password
        assert!(verify_password(password, &hash).expect("Verification should not error"));
        
        // Verification should fail with wrong password
        assert!(!verify_password("wrong_password", &hash).expect("Verification should not error"));
    }

    #[test]
    fn test_different_passwords_produce_different_hashes() {
        let hash1 = hash_password("password1").expect("Hashing should succeed");
        let hash2 = hash_password("password2").expect("Hashing should succeed");
        
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_same_password_produces_different_hashes() {
        // Due to random salt, same password should produce different hashes
        let hash1 = hash_password("same_password").expect("Hashing should succeed");
        let hash2 = hash_password("same_password").expect("Hashing should succeed");
        
        assert_ne!(hash1, hash2);
        
        // But both should verify correctly
        assert!(verify_password("same_password", &hash1).expect("Verification should not error"));
        assert!(verify_password("same_password", &hash2).expect("Verification should not error"));
    }
}
