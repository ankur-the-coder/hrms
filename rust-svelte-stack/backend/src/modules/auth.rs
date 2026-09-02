use axum::{extract::State, Json};
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng}, Argon2};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::{error::{ApiResult, AppError}, tenant::{Claims, TenantCtx}, AppState};

#[derive(Deserialize)]
pub struct AuthBody { pub email: String, pub password: String, pub full_name: Option<String> }

#[derive(Serialize)]
pub struct AuthOut { pub token: String, pub user: UserOut }

#[derive(Serialize, sqlx::FromRow)]
pub struct UserOut {
    pub id: i64,
    pub tenant_id: Uuid,
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
    pub prefs: serde_json::Value,
}

fn issue(state: &AppState, u: &UserOut) -> ApiResult<String> {
    let claims = Claims {
        sub: u.id, tid: u.tenant_id, role: u.role.clone(),
        exp: (chrono::Utc::now() + chrono::Duration::hours(12)).timestamp() as usize,
    };
    Ok(encode(&Header::default(), &claims, &EncodingKey::from_secret(state.cfg.jwt_secret.as_bytes()))
        .map_err(|e| AppError::Other(e.into()))?)
}

pub async fn signup(State(state): State<AppState>, Json(body): Json<AuthBody>) -> ApiResult<Json<AuthOut>> {
    let email = body.email.trim().to_lowercase();
    if !email.contains('@') { return Err(AppError::BadRequest("invalid email".into())); }
    if body.password.len() < 6 { return Err(AppError::BadRequest("password too short".into())); }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default().hash_password(body.password.as_bytes(), &salt)
        .map_err(|_| AppError::BadRequest("hash failed".into()))?.to_string();

    // default tenant for the demo flow; real signups create/join a tenant explicitly
    let tenant_id: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (name, slug) VALUES ('Aviary Technologies','aviary')
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id")
        .fetch_one(&state.pool).await?;

    let user: UserOut = sqlx::query_as(
        "INSERT INTO users (tenant_id, email, full_name, password_hash, role, prefs)
         VALUES ($1, $2, $3, $4,
                 CASE WHEN NOT EXISTS (SELECT 1 FROM users WHERE tenant_id=$1) THEN 'Owner' ELSE 'Member' END,
                 '{\"theme\":\"soft\",\"mode\":\"light\",\"language\":\"en\",\"wallpaper\":\"none\"}')
         RETURNING id, tenant_id, email, full_name, role, prefs")
        .bind(tenant_id).bind(&email).bind(&body.full_name).bind(&hash)
        .fetch_one(&state.pool).await
        .map_err(|_| AppError::BadRequest("email already registered".into()))?;

    let token = issue(&state, &user)?;
    Ok(Json(AuthOut { token, user }))
}

pub async fn login(State(state): State<AppState>, Json(body): Json<AuthBody>) -> ApiResult<Json<AuthOut>> {
    let email = body.email.trim().to_lowercase();
    let row: Option<(UserOut, String)> = sqlx::query_as::<_, (i64, Uuid, String, Option<String>, String, serde_json::Value, String)>(
        "SELECT id, tenant_id, email, full_name, role, prefs, password_hash FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.pool).await?
        .map(|(id, tenant_id, email, full_name, role, prefs, ph)|
            (UserOut { id, tenant_id, email, full_name, role, prefs }, ph));

    let (user, ph) = row.ok_or(AppError::Unauthorized)?;
    let parsed = PasswordHash::new(&ph).map_err(|_| AppError::Unauthorized)?;
    Argon2::default().verify_password(body.password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)?;

    let token = issue(&state, &user)?;
    Ok(Json(AuthOut { token, user }))
}

pub async fn me(State(state): State<AppState>, ctx: TenantCtx) -> ApiResult<Json<UserOut>> {
    let user: UserOut = sqlx::query_as(
        "SELECT id, tenant_id, email, full_name, role, prefs FROM users WHERE id = $1 AND tenant_id = $2")
        .bind(ctx.user_id).bind(ctx.tenant_id)
        .fetch_optional(&state.pool).await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(user))
}
