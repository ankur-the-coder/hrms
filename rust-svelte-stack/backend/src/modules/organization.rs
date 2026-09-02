use axum::{extract::{Query, State}, Json};
use serde::{Deserialize, Serialize};
use crate::{error::ApiResult, tenant::{tenant_tx, TenantCtx}, AppState};

#[derive(Serialize, sqlx::FromRow)]
pub struct OrgPerson {
    pub id: i64,
    pub full_name: String,
    pub email: Option<String>,
    pub gender: Option<String>,
    pub dept: Option<String>,
    pub role: Option<String>,
    pub status: String,
    pub location: Option<String>,
    pub employment_type: Option<String>,
    pub worker_type: Option<String>,
    pub nationality: Option<String>,
    pub business_unit: Option<String>,
    pub cost_center: Option<String>,
    pub legal_entity: Option<String>,
    pub joined: chrono::NaiveDate,
    pub exit_date: Option<chrono::NaiveDate>,
    pub exit_reason: Option<String>,
    pub exit_type: Option<String>,
    pub dob: Option<chrono::NaiveDate>,
    pub salary: i64,
}

#[derive(Deserialize)]
pub struct PeopleQuery {
    pub after: Option<i64>,
    pub limit: Option<i64>,
    pub business_unit: Option<String>,
    pub dept: Option<String>,
    pub location: Option<String>,
    pub cost_center: Option<String>,
    pub legal_entity: Option<String>,
    pub worker_type: Option<String>,
}

/// GET /api/v1/org/people — tenant-scoped, keyset-paginated, demographic filters
pub async fn people(State(state): State<AppState>, ctx: TenantCtx, Query(q): Query<PeopleQuery>) -> ApiResult<Json<Vec<OrgPerson>>> {
    let limit = q.limit.unwrap_or(200).clamp(1, 600);
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let rows: Vec<OrgPerson> = sqlx::query_as(
        "SELECT id, full_name, email::text, gender, dept, role, status, location,
                employment_type, worker_type, nationality, business_unit, cost_center,
                legal_entity, joined, exit_date, exit_reason, exit_type, dob, salary
         FROM people
         WHERE tenant_id = current_setting('app.tenant_id')::uuid AND id > $1
           AND ($2::text IS NULL OR business_unit = $2)
           AND ($3::text IS NULL OR dept = $3)
           AND ($4::text IS NULL OR location = $4)
           AND ($5::text IS NULL OR cost_center = $5)
           AND ($6::text IS NULL OR legal_entity = $6)
           AND ($7::text IS NULL OR worker_type = $7)
         ORDER BY id LIMIT $8")
        .bind(q.after.unwrap_or(0))
        .bind(&q.business_unit).bind(&q.dept).bind(&q.location)
        .bind(&q.cost_center).bind(&q.legal_entity).bind(&q.worker_type)
        .bind(limit)
        .fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Serialize, sqlx::FromRow)]
pub struct AuditEvent {
    pub id: i64,
    pub actor: String,
    pub category: String,
    pub sub_category: Option<String>,
    pub attribute: Option<String>,
    pub event: String,
    pub detail: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct AuditQuery {
    pub from: Option<chrono::NaiveDate>,
    pub to: Option<chrono::NaiveDate>,
    pub category: Option<String>,
    pub actor: Option<String>,
    pub sub_category: Option<String>,
    pub attribute: Option<String>,
    pub event: Option<String>,
    pub limit: Option<i64>,
}

/// GET /api/v1/org/audit — Date Range · Category · Employee · Sub Category · Attribute · Event
pub async fn audit(State(state): State<AppState>, ctx: TenantCtx, Query(q): Query<AuditQuery>) -> ApiResult<Json<Vec<AuditEvent>>> {
    let limit = q.limit.unwrap_or(400).clamp(1, 500);
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let rows: Vec<AuditEvent> = sqlx::query_as(
        "SELECT id, actor, category, sub_category, attribute, event, detail, created_at
         FROM audit_events
         WHERE tenant_id = current_setting('app.tenant_id')::uuid
           AND ($1::date IS NULL OR created_at >= $1::date)
           AND ($2::date IS NULL OR created_at < ($2::date + 1))
           AND ($3::text IS NULL OR category = $3)
           AND ($4::text IS NULL OR actor = $4)
           AND ($5::text IS NULL OR sub_category = $5)
           AND ($6::text IS NULL OR attribute = $6)
           AND ($7::text IS NULL OR event = $7)
         ORDER BY created_at DESC LIMIT $8")
        .bind(q.from).bind(q.to).bind(&q.category).bind(&q.actor)
        .bind(&q.sub_category).bind(&q.attribute).bind(&q.event)
        .bind(limit)
        .fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(rows))
}
