use regex::Regex;
use std::sync::LazyLock;

/// Email validation regex pattern
static EMAIL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        .expect("Email regex should be valid")
});

/// Validate email format
pub fn is_valid_email(email: &str) -> bool {
    EMAIL_REGEX.is_match(email)
}

/// Validate password strength
/// Requirements: at least 8 characters
pub fn is_valid_password(password: &str) -> bool {
    password.len() >= 8
}

/// Validate that a string is not empty or whitespace only
pub fn is_not_empty(s: &str) -> bool {
    !s.trim().is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_emails() {
        assert!(is_valid_email("test@example.com"));
        assert!(is_valid_email("user.name@domain.org"));
        assert!(is_valid_email("user+tag@example.co.uk"));
    }

    #[test]
    fn test_invalid_emails() {
        assert!(!is_valid_email(""));
        assert!(!is_valid_email("invalid"));
        assert!(!is_valid_email("@example.com"));
        assert!(!is_valid_email("test@"));
        assert!(!is_valid_email("test@.com"));
    }

    #[test]
    fn test_valid_passwords() {
        assert!(is_valid_password("password123"));
        assert!(is_valid_password("12345678"));
        assert!(is_valid_password("a very long password"));
    }

    #[test]
    fn test_invalid_passwords() {
        assert!(!is_valid_password(""));
        assert!(!is_valid_password("short"));
        assert!(!is_valid_password("1234567")); // 7 chars
    }

    #[test]
    fn test_is_not_empty() {
        assert!(is_not_empty("hello"));
        assert!(is_not_empty(" hello "));
        assert!(!is_not_empty(""));
        assert!(!is_not_empty("   "));
    }
}
