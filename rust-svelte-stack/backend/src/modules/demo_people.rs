use axum::{extract::{Query, State}, Json};
use serde::{Deserialize, Serialize};
use crate::{error::{ApiResult, AppError}, tenant::{tenant_tx, TenantCtx}, AppState};

#[derive(Serialize, sqlx::FromRow)]
pub struct Person {
    pub id: i64,
    pub full_name: String,
    pub dept: String,
    pub role: String,
    pub status: String,
    pub city: String,
    pub joined: chrono::NaiveDate,
    pub salary: i64,
}

#[derive(Deserialize)]
pub struct ListQuery {
    /// keyset cursor: last seen id (GUIDELINES.md §3 — no OFFSET)
    pub after: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn list(State(state): State<AppState>, ctx: TenantCtx, Query(q): Query<ListQuery>) -> ApiResult<Json<Vec<Person>>> {
    let limit = q.limit.unwrap_or(100).clamp(1, 200);
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let rows: Vec<Person> = sqlx::query_as(
        "SELECT id, full_name, dept, role, status, city, joined, salary
         FROM demo_people
         WHERE tenant_id = current_setting('app.tenant_id')::uuid AND id > $1
         ORDER BY id LIMIT $2")
        .bind(q.after.unwrap_or(0)).bind(limit)
        .fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Deserialize)]
pub struct BulkBody { pub ids: Vec<i64>, pub status: Option<String> }

pub async fn bulk_update(State(state): State<AppState>, ctx: TenantCtx, Json(b): Json<BulkBody>) -> ApiResult<Json<u64>> {
    let status = b.status.ok_or(AppError::BadRequest("status required".into()))?;
    if b.ids.is_empty() || b.ids.len() > 500 { return Err(AppError::BadRequest("1..500 ids".into())); }
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let res = sqlx::query(
        "UPDATE demo_people SET status = $2
         WHERE tenant_id = current_setting('app.tenant_id')::uuid AND id = ANY($1)")
        .bind(&b.ids).bind(&status)
        .execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(res.rows_affected()))
}

pub async fn bulk_delete(State(state): State<AppState>, ctx: TenantCtx, Json(b): Json<BulkBody>) -> ApiResult<Json<u64>> {
    if b.ids.is_empty() || b.ids.len() > 500 { return Err(AppError::BadRequest("1..500 ids".into())); }
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let res = sqlx::query(
        "DELETE FROM demo_people
         WHERE tenant_id = current_setting('app.tenant_id')::uuid AND id = ANY($1)")
        .bind(&b.ids)
        .execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(res.rows_affected()))
}
