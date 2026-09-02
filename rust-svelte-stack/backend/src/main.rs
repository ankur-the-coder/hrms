mod config;
mod db;
mod error;
mod crypto;
mod tenant;
mod modules;

use axum::{routing::{get, post, put, delete}, Router};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer, compression::CompressionLayer};

#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub crypto: Arc<crypto::FieldCipher>,
    pub cfg: Arc<config::Config>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt().with_env_filter("info,sqlx=warn").init();

    let cfg = Arc::new(config::Config::from_env()?);
    let pool = db::pool(&cfg.database_url).await?;
    let crypto = Arc::new(crypto::FieldCipher::from_config(&cfg)?);
    let state = AppState { pool, crypto, cfg };

    let api = Router::new()
        // auth
        .route("/auth/signup", post(modules::auth::signup))
        .route("/auth/login", post(modules::auth::login))
        .route("/auth/me", get(modules::auth::me))
        // user preferences (theme / wallpaper / language / custom theme)
        .route("/prefs", get(modules::prefs::get_prefs).put(modules::prefs::put_prefs))
        // demo people (shared DataTable data source)
        .route("/demo-people", get(modules::demo_people::list))
        .route("/demo-people/bulk", put(modules::demo_people::bulk_update).delete(modules::demo_people::bulk_delete))
        // organization module
        .route("/org/people", get(modules::organization::people))
        .route("/org/audit", get(modules::organization::audit))
        // org structure module
        .route("/org/structure", get(modules::orgstructure::bootstrap))
        .route("/org/structure/bulk-assign", post(modules::orgstructure::bulk_assign))
        .route("/org/structure/fetch-link", post(modules::orgstructure::fetch_link))
        .route("/org/structure/{resource}", post(modules::orgstructure::crud))
        .route("/health", get(|| async { "ok" }));

    let app = Router::new()
        .nest("/api/v1", api)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    tracing::info!("aviary backend listening on :8080");
    axum::serve(listener, app).await?;
    Ok(())
}
