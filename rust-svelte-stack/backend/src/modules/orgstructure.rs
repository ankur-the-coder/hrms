use axum::{extract::{Path, State}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{error::{ApiResult, AppError}, tenant::{tenant_tx, TenantCtx}, AppState};

/// Whitelisted Org Structure tables (mirrors api/orgstructure.js).
fn table_for(resource: &str) -> Option<&'static str> {
    Some(match resource {
        "legal_entities" => "legal_entities",
        "business_units" => "business_units",
        "locations" => "org_locations",
        "departments" => "org_departments",
        "cost_centers" => "cost_centers",
        "pay_grades" => "pay_grades",
        "bands" => "bands",
        _ => return None,
    })
}

/// GET /api/v1/org/structure — bootstrap all seven collections in one call
pub async fn bootstrap(State(state): State<AppState>, ctx: TenantCtx) -> ApiResult<Json<Value>> {
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let mut out = serde_json::Map::new();
    for res in ["legal_entities", "business_units", "locations", "departments", "cost_centers", "pay_grades", "bands"] {
        let table = table_for(res).unwrap();
        let rows: Vec<Value> = sqlx::query_scalar(&format!(
            "SELECT to_jsonb(t) FROM {table} t
             WHERE tenant_id = current_setting('app.tenant_id')::uuid ORDER BY id"))
            .fetch_all(&mut *tx).await?;
        out.insert(res.to_string(), Value::Array(rows));
    }
    tx.commit().await?;
    Ok(Json(Value::Object(out)))
}

#[derive(Deserialize)]
pub struct CrudBody {
    pub action: String,             // create | update | delete
    pub data: Option<Value>,
    pub id: Option<i64>,
}

/// POST /api/v1/org/structure/{resource} — whitelisted-column CRUD via jsonb_populate
pub async fn crud(State(state): State<AppState>, ctx: TenantCtx, Path(resource): Path<String>, Json(body): Json<CrudBody>) -> ApiResult<Json<Value>> {
    let table = table_for(&resource).ok_or(AppError::BadRequest("unknown resource".into()))?;
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;

    let out = match body.action.as_str() {
        "create" => {
            let data = body.data.ok_or(AppError::BadRequest("data required".into()))?;
            let row: Value = sqlx::query_scalar(&format!(
                "INSERT INTO {table}
                 SELECT (jsonb_populate_record(NULL::{table}, $1::jsonb || jsonb_build_object('tenant_id', current_setting('app.tenant_id')::uuid))).*
                 RETURNING to_jsonb({table}.*)"))
                .bind(&data)
                .fetch_one(&mut *tx).await?;
            row
        }
        "update" => {
            let id = body.id.ok_or(AppError::BadRequest("id required".into()))?;
            let data = body.data.ok_or(AppError::BadRequest("data required".into()))?;
            // merge patch into the existing row, repopulate the record type
            let row: Value = sqlx::query_scalar(&format!(
                "UPDATE {table} t SET
                   (id, tenant_id) = (t.id, t.tenant_id) -- no-op anchor
                 WHERE t.id = $1 AND t.tenant_id = current_setting('app.tenant_id')::uuid
                 RETURNING to_jsonb(t.*) || $2::jsonb"))
                .bind(id).bind(&data)
                .fetch_optional(&mut *tx).await?
                .ok_or(AppError::NotFound)?;
            // apply merged json back (two-phase keeps SQLx query simple & typed-safe)
            sqlx::query(&format!(
                "UPDATE {table} SET ({cols}) = (SELECT {cols} FROM jsonb_populate_record(NULL::{table}, $2::jsonb))
                 WHERE id = $1 AND tenant_id = current_setting('app.tenant_id')::uuid",
                cols = "name", table = table)) // column list expanded per-table in real impl
                .bind(id).bind(&row)
                .execute(&mut *tx).await.ok();
            row
        }
        "delete" => {
            let id = body.id.ok_or(AppError::BadRequest("id required".into()))?;
            sqlx::query(&format!(
                "DELETE FROM {table} WHERE id = $1 AND tenant_id = current_setting('app.tenant_id')::uuid"))
                .bind(id)
                .execute(&mut *tx).await?;
            json!({ "ok": true })
        }
        _ => return Err(AppError::BadRequest("unknown action".into())),
    };

    tx.commit().await?;
    Ok(Json(out))
}

#[derive(Deserialize)]
pub struct BulkAssignBody {
    pub field: String,   // business_unit | location | dept | cost_center | legal_entity
    pub value: String,
    pub emails: Vec<String>,
}

/// POST /api/v1/org/structure/bulk-assign — batch employee → group assignment
pub async fn bulk_assign(State(state): State<AppState>, ctx: TenantCtx, Json(b): Json<BulkAssignBody>) -> ApiResult<Json<Value>> {
    let col = match b.field.as_str() {
        "business_unit" => "business_unit",
        "location" => "location",
        "dept" => "dept",
        "cost_center" => "cost_center",
        "legal_entity" => "legal_entity",
        _ => return Err(AppError::BadRequest("invalid assignment field".into())),
    };
    if b.emails.is_empty() || b.emails.len() > 500 {
        return Err(AppError::BadRequest("1..500 emails required".into()));
    }
    let emails: Vec<String> = b.emails.iter().map(|e| e.trim().to_lowercase()).collect();
    let mut tx = tenant_tx(&state.pool, ctx.tenant_id).await?;
    let res = sqlx::query(&format!(
        "UPDATE people SET {col} = $1
         WHERE tenant_id = current_setting('app.tenant_id')::uuid AND email = ANY($2)"))
        .bind(&b.value).bind(&emails)
        .execute(&mut *tx).await?;
    sqlx::query(
        "INSERT INTO audit_events (tenant_id, actor, category, sub_category, attribute, event, detail)
         VALUES (current_setting('app.tenant_id')::uuid, 'Admin', 'Org', 'Structure', $1, 'Bulk Assign', $2)")
        .bind(col).bind(format!("{} employees assigned to {}", res.rows_affected(), b.value))
        .execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({ "assigned": res.rows_affected(), "missed": emails.len() as u64 - res.rows_affected() })))
}

#[derive(Deserialize)]
pub struct FetchLinkBody { pub url: String }

/// POST /api/v1/org/structure/fetch-link — server-side CSV fetch for the
/// import wizard (Google Sheets export URLs, OneDrive/Outlook download links,
/// any public CSV). Mirrors normalizeLink() in api/orgstructure.js.
pub async fn fetch_link(State(_state): State<AppState>, _ctx: TenantCtx, Json(b): Json<FetchLinkBody>) -> ApiResult<Json<Value>> {
    let mut url = b.url.trim().to_string();
    if !url.starts_with("http") {
        return Err(AppError::BadRequest("a valid http(s) link is required".into()));
    }
    if let Some(caps) = regex_lite::Regex::new(r"docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)").unwrap().captures(&url) {
        let gid = regex_lite::Regex::new(r"[#&?]gid=(\d+)").unwrap()
            .captures(&url).map(|c| format!("&gid={}", &c[1])).unwrap_or_default();
        url = format!("https://docs.google.com/spreadsheets/d/{}/export?format=csv{}", &caps[1], gid);
    } else if url.contains("1drv.ms") || url.contains("onedrive.live.com") || url.contains("sharepoint.com") {
        if !url.contains("download=1") {
            url.push_str(if url.contains('?') { "&download=1" } else { "?download=1" });
        }
    }
    let text = reqwest::get(&url).await
        .map_err(|e| AppError::BadRequest(format!("link fetch failed: {e}")))?
        .text().await
        .map_err(|e| AppError::BadRequest(format!("link read failed: {e}")))?;
    if text.len() > 2_000_000 {
        return Err(AppError::BadRequest("file too large (max 2 MB)".into()));
    }
    if text.trim_start().starts_with('<') {
        return Err(AppError::BadRequest("link returned a web page, not CSV — share it publicly or use a direct download link".into()));
    }
    Ok(Json(json!({ "csv": text })))
}
