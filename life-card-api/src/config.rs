use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub app_name: String,
    pub app_env: String,
    pub app_host: String,
    pub app_port: u16,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub default_coin_balance: i32,
    pub default_card_price: i32,
    pub exchange_expiration_hours: i64,
    pub wechat_app_id: String,
    pub wechat_app_secret: String,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        dotenvy::dotenv().ok();

        Ok(Config {
            app_name: env::var("APP_NAME").unwrap_or_else(|_| "life-card-api".to_string()),
            app_env: env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()),
            app_host: env::var("APP_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            app_port: env::var("APP_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            database_url: env::var("DATABASE_URL")?,
            redis_url: env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret: env::var("JWT_SECRET")?,
            jwt_expiration_hours: env::var("JWT_EXPIRATION_HOURS")
                .unwrap_or_else(|_| "168".to_string())
                .parse()
                .unwrap_or(168),
            default_coin_balance: env::var("DEFAULT_COIN_BALANCE")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            default_card_price: env::var("DEFAULT_CARD_PRICE")
                .unwrap_or_else(|_| "10".to_string())
                .parse()
                .unwrap_or(10),
            exchange_expiration_hours: env::var("EXCHANGE_EXPIRATION_HOURS")
                .unwrap_or_else(|_| "72".to_string())
                .parse()
                .unwrap_or(72),
            wechat_app_id: env::var("WECHAT_APP_ID").unwrap_or_default(),
            wechat_app_secret: env::var("WECHAT_APP_SECRET").unwrap_or_default(),
        })
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }
}
