//! Tenant extractor — pulls tenant_id from the verified JWT and pins it onto
//! the DB session so Row-Level Security enforces isolation (GUIDELINES.md §3).

use axum::{extract::FromRequestParts, http::request::Parts};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64,          // user id
    pub tid: Uuid,         // tenant id
    pub role: String,
    pub exp: usize,
}

pub struct TenantCtx {
    pub user_id: i64,
    pub tenant_id: Uuid,
    pub role: String,
}

impl FromRequestParts<crate::AppState> for TenantCtx {
    type Rejection = crate::error::AppError;

    async fn from_request_parts(parts: &mut Parts, state: &crate::AppState) -> Result<Self, Self::Rejection> {
        let token = parts.headers.get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(crate::error::AppError::Unauthorized)?;
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.cfg.jwt_secret.as_bytes()),
            &Validation::default(),
        ).map_err(|_| crate::error::AppError::Unauthorized)?;
        Ok(TenantCtx { user_id: data.claims.sub, tenant_id: data.claims.tid, role: data.claims.role })
    }
}

/// Begin a transaction with RLS tenant binding applied.
pub async fn tenant_tx<'a>(
    pool: &sqlx::PgPool,
    tenant_id: Uuid,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}
