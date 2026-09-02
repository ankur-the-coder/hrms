use axum::{extract::State, Json};
use crate::{error::ApiResult, tenant::TenantCtx, AppState};

/// GET /api/v1/prefs — theme / mode / language / wallpaper / custom theme JSON
pub async fn get_prefs(State(state): State<AppState>, ctx: TenantCtx) -> ApiResult<Json<serde_json::Value>> {
    let prefs: serde_json::Value = sqlx::query_scalar(
        "SELECT prefs FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(ctx.user_id).bind(ctx.tenant_id)
        .fetch_one(&state.pool).await?;
    Ok(Json(prefs))
}

/// PUT /api/v1/prefs — whole-document merge (client owns the shape)
pub async fn put_prefs(State(state): State<AppState>, ctx: TenantCtx, Json(prefs): Json<serde_json::Value>) -> ApiResult<Json<serde_json::Value>> {
    let updated: serde_json::Value = sqlx::query_scalar(
        "UPDATE users SET prefs = prefs || $3, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 RETURNING prefs")
        .bind(ctx.user_id).bind(ctx.tenant_id).bind(&prefs)
        .fetch_one(&state.pool).await?;
    Ok(Json(updated))
}
