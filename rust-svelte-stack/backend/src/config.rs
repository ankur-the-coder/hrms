use anyhow::Context;

pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    /// 32-byte hex AES-256-GCM data key (prod: KMS envelope-decrypted at boot)
    pub enc_key_hex: String,
    /// 32-byte hex HMAC key for blind indexes — MUST differ from enc key
    pub idx_key_hex: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL").context("DATABASE_URL")?,
            jwt_secret: std::env::var("JWT_SECRET").context("JWT_SECRET")?,
            enc_key_hex: std::env::var("APP_ENC_KEY").context("APP_ENC_KEY")?,
            idx_key_hex: std::env::var("APP_IDX_KEY").context("APP_IDX_KEY")?,
        })
    }
}
