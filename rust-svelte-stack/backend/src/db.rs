use sqlx::postgres::PgPoolOptions;

/// Small per-instance pool; PgBouncer (transaction mode) sits in front and
/// fans many app instances into Postgres. See GUIDELINES.md §1/§5.
pub async fn pool(url: &str) -> anyhow::Result<sqlx::PgPool> {
    Ok(PgPoolOptions::new()
        .max_connections(16)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(url)
        .await?)
}
