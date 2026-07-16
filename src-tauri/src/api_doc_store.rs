use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow,
    SqliteSynchronous,
};
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool, Transaction};
use std::collections::HashMap;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::State;
use tokio::sync::OnceCell;

const CACHE_FILE: &str = "api-doc-cache.db";
const MAX_QUERY_LIMIT: i64 = 2_500;
static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(1);

struct StorePools {
    /// SQLite 只能同时提交一个写事务。固定单连接可避免写线程互相争锁。
    writer: SqlitePool,
    /// WAL 下只读连接不会阻塞 writer，分页预览和导出可以并发执行。
    readers: SqlitePool,
}

pub struct ApiDocStore {
    db_path: PathBuf,
    pools: OnceCell<StorePools>,
}

impl ApiDocStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            db_path: app_data_dir.join(CACHE_FILE),
            pools: OnceCell::new(),
        }
    }

    async fn pools(&self) -> Result<&StorePools, String> {
        self.pools
            .get_or_try_init(|| async {
                if let Some(parent) = self.db_path.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }

                let url = format!("sqlite://{}", self.db_path.to_string_lossy().replace('\\', "/"));
                let options = SqliteConnectOptions::from_str(&url)
                    .map_err(|e| e.to_string())?
                    .create_if_missing(true)
                    .journal_mode(SqliteJournalMode::Wal)
                    .synchronous(SqliteSynchronous::Normal)
                    .foreign_keys(true)
                    .busy_timeout(Duration::from_secs(10))
                    .pragma("wal_autocheckpoint", "1000")
                    .pragma("temp_store", "FILE")
                    .pragma("cache_size", "-8192");

                let writer = SqlitePoolOptions::new()
                    .max_connections(1)
                    .min_connections(1)
                    .acquire_timeout(Duration::from_secs(15))
                    .connect_with(options.clone())
                    .await
                    .map_err(|e| e.to_string())?;

                init_schema(&writer).await?;

                let reader_count = std::thread::available_parallelism()
                    .map(|n| n.get() as u32)
                    .unwrap_or(2)
                    .clamp(2, 4);
                let readers = SqlitePoolOptions::new()
                    .max_connections(reader_count)
                    .min_connections(1)
                    .acquire_timeout(Duration::from_secs(10))
                    .connect_with(options)
                    .await
                    .map_err(|e| e.to_string())?;

                Ok(StorePools { writer, readers })
            })
            .await
    }
}

async fn init_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::raw_sql(
        r#"
        CREATE TABLE IF NOT EXISTS api_doc_jobs (
          id TEXT PRIMARY KEY,
          project_path TEXT NOT NULL,
          language TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'running',
          total_files INTEGER NOT NULL DEFAULT 0,
          processed_files INTEGER NOT NULL DEFAULT 0,
          source_bytes INTEGER NOT NULL DEFAULT 0,
          module_count INTEGER NOT NULL DEFAULT 0,
          api_count INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS api_doc_schemas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL,
          type_name TEXT NOT NULL,
          fields_json TEXT NOT NULL DEFAULT '[]',
          example_json TEXT,
          FOREIGN KEY(job_id) REFERENCES api_doc_jobs(id) ON DELETE CASCADE,
          UNIQUE(job_id, type_name)
        );

        CREATE TABLE IF NOT EXISTS api_doc_modules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          name TEXT NOT NULL,
          class_name TEXT NOT NULL,
          base_path TEXT NOT NULL DEFAULT '',
          module_path TEXT NOT NULL DEFAULT '',
          file TEXT NOT NULL DEFAULT '',
          api_count INTEGER NOT NULL DEFAULT 0,
          method_stats_json TEXT NOT NULL DEFAULT '{}',
          FOREIGN KEY(job_id) REFERENCES api_doc_jobs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS api_doc_apis (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL,
          module_id INTEGER NOT NULL,
          order_index INTEGER NOT NULL,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          summary TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          method_name TEXT NOT NULL DEFAULT '',
          params_json TEXT NOT NULL DEFAULT '[]',
          request_schema_id INTEGER,
          response_schema_id INTEGER,
          FOREIGN KEY(job_id) REFERENCES api_doc_jobs(id) ON DELETE CASCADE,
          FOREIGN KEY(module_id) REFERENCES api_doc_modules(id) ON DELETE CASCADE,
          FOREIGN KEY(request_schema_id) REFERENCES api_doc_schemas(id),
          FOREIGN KEY(response_schema_id) REFERENCES api_doc_schemas(id)
        );

        CREATE INDEX IF NOT EXISTS idx_api_doc_jobs_updated
          ON api_doc_jobs(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_api_doc_modules_job_order
          ON api_doc_modules(job_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_api_doc_modules_job_class
          ON api_doc_modules(job_id, class_name);
        CREATE INDEX IF NOT EXISTS idx_api_doc_apis_job_module_order
          ON api_doc_apis(job_id, module_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_api_doc_apis_job_method
          ON api_doc_apis(job_id, method);
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn new_job_id() -> String {
    format!(
        "api_{}_{}",
        now_millis(),
        JOB_SEQUENCE.fetch_add(1, Ordering::Relaxed)
    )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocBodyInput {
    #[serde(rename = "type")]
    body_type: String,
    #[serde(default = "empty_array")]
    fields: Value,
    #[serde(default)]
    example: Option<Value>,
}

fn empty_array() -> Value {
    json!([])
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocApiInput {
    #[serde(default)]
    id: Option<i64>,
    method: String,
    path: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    method_name: String,
    #[serde(default = "empty_array")]
    params: Value,
    #[serde(default)]
    request_body: Option<ApiDocBodyInput>,
    #[serde(default)]
    response: Option<ApiDocBodyInput>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocModuleInput {
    name: String,
    class_name: String,
    #[serde(default)]
    base_path: String,
    #[serde(default)]
    module_path: String,
    #[serde(default)]
    file: String,
    #[serde(default)]
    apis: Vec<ApiDocApiInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocAppendResult {
    module_count: i64,
    api_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocJob {
    id: String,
    project_path: String,
    language: String,
    status: String,
    total_files: i64,
    processed_files: i64,
    source_bytes: i64,
    module_count: i64,
    api_count: i64,
    error: Option<String>,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocModuleRecord {
    id: i64,
    name: String,
    class_name: String,
    base_path: String,
    module_path: String,
    file: String,
    api_count: i64,
    method_stats: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocBodyRecord {
    schema_id: i64,
    #[serde(rename = "type")]
    body_type: String,
    fields: Value,
    example: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocApiRecord {
    id: i64,
    module_id: i64,
    module_name: String,
    module_class_name: String,
    module_base_path: String,
    module_path: String,
    module_file: String,
    method: String,
    path: String,
    summary: String,
    description: String,
    method_name: String,
    params: Value,
    request_body: Option<ApiDocBodyRecord>,
    response: Option<ApiDocBodyRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiDocPage {
    items: Vec<ApiDocApiRecord>,
    limit: i64,
    offset: i64,
}

async fn upsert_schema(
    tx: &mut Transaction<'_, Sqlite>,
    job_id: &str,
    body: &ApiDocBodyInput,
) -> Result<i64, String> {
    let fields_json = serde_json::to_string(&body.fields).map_err(|e| e.to_string())?;
    let example_json = body
        .example
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| e.to_string())?;
    sqlx::query_scalar::<_, i64>(
        r#"
        INSERT INTO api_doc_schemas(job_id, type_name, fields_json, example_json)
        VALUES(?1, ?2, ?3, ?4)
        ON CONFLICT(job_id, type_name) DO UPDATE SET
          fields_json = CASE
            WHEN api_doc_schemas.fields_json = '[]' THEN excluded.fields_json
            ELSE api_doc_schemas.fields_json
          END,
          example_json = COALESCE(excluded.example_json, api_doc_schemas.example_json)
        RETURNING id
        "#,
    )
    .bind(job_id)
    .bind(&body.body_type)
    .bind(fields_json)
    .bind(example_json)
    .fetch_one(&mut **tx)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn api_doc_create_job(
    store: State<'_, ApiDocStore>,
    project_path: String,
    language: String,
    total_files: i64,
    source_bytes: i64,
) -> Result<String, String> {
    let pools = store.pools().await?;
    let id = new_job_id();
    let now = now_millis();

    // 缓存只用于任务恢复与分页，清理 7 天前的数据，避免数据库无限增长。
    let cutoff = now - 7 * 24 * 60 * 60 * 1000;
    sqlx::query("DELETE FROM api_doc_jobs WHERE updated_at < ?1")
        .bind(cutoff)
        .execute(&pools.writer)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO api_doc_jobs(
          id, project_path, language, status, total_files, source_bytes, created_at, updated_at
        ) VALUES(?1, ?2, ?3, 'running', ?4, ?5, ?6, ?6)
        "#,
    )
    .bind(&id)
    .bind(project_path)
    .bind(language)
    .bind(total_files.max(0))
    .bind(source_bytes.max(0))
    .bind(now)
    .execute(&pools.writer)
    .await
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub async fn api_doc_append_modules(
    store: State<'_, ApiDocStore>,
    job_id: String,
    modules: Vec<ApiDocModuleInput>,
    processed_files: i64,
) -> Result<ApiDocAppendResult, String> {
    let pools = store.pools().await?;
    let mut tx = pools.writer.begin().await.map_err(|e| e.to_string())?;
    let start_order = sqlx::query_scalar::<_, i64>(
        "SELECT module_count FROM api_doc_jobs WHERE id = ?1",
    )
    .bind(&job_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "接口文档任务不存在".to_string())?;

    let mut added_modules = 0_i64;
    let mut added_apis = 0_i64;
    let mut schema_ids = HashMap::<String, i64>::new();

    for module in modules {
        let mut method_stats = HashMap::<String, i64>::new();
        for api in &module.apis {
            *method_stats.entry(api.method.clone()).or_default() += 1;
        }
        let method_stats_json = serde_json::to_string(&method_stats).map_err(|e| e.to_string())?;
        let module_id = sqlx::query_scalar::<_, i64>(
            r#"
            INSERT INTO api_doc_modules(
              job_id, order_index, name, class_name, base_path, module_path,
              file, api_count, method_stats_json
            ) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            RETURNING id
            "#,
        )
        .bind(&job_id)
        .bind(start_order + added_modules)
        .bind(&module.name)
        .bind(&module.class_name)
        .bind(&module.base_path)
        .bind(&module.module_path)
        .bind(&module.file)
        .bind(module.apis.len() as i64)
        .bind(method_stats_json)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        for (api_order, api) in module.apis.iter().enumerate() {
            let request_schema_id = if let Some(body) = &api.request_body {
                if let Some(id) = schema_ids.get(&body.body_type) {
                    Some(*id)
                } else {
                    let id = upsert_schema(&mut tx, &job_id, body).await?;
                    schema_ids.insert(body.body_type.clone(), id);
                    Some(id)
                }
            } else {
                None
            };
            let response_schema_id = if let Some(body) = &api.response {
                if let Some(id) = schema_ids.get(&body.body_type) {
                    Some(*id)
                } else {
                    let id = upsert_schema(&mut tx, &job_id, body).await?;
                    schema_ids.insert(body.body_type.clone(), id);
                    Some(id)
                }
            } else {
                None
            };
            let params_json = serde_json::to_string(&api.params).map_err(|e| e.to_string())?;
            sqlx::query(
                r#"
                INSERT INTO api_doc_apis(
                  job_id, module_id, order_index, method, path, summary, description,
                  method_name, params_json, request_schema_id, response_schema_id
                ) VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
            )
            .bind(&job_id)
            .bind(module_id)
            .bind(api_order as i64)
            .bind(&api.method)
            .bind(&api.path)
            .bind(&api.summary)
            .bind(&api.description)
            .bind(&api.method_name)
            .bind(params_json)
            .bind(request_schema_id)
            .bind(response_schema_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            added_apis += 1;
        }
        added_modules += 1;
    }

    let now = now_millis();
    sqlx::query(
        r#"
        UPDATE api_doc_jobs SET
          processed_files = MAX(processed_files, ?1),
          module_count = module_count + ?2,
          api_count = api_count + ?3,
          updated_at = ?4
        WHERE id = ?5
        "#,
    )
    .bind(processed_files.max(0))
    .bind(added_modules)
    .bind(added_apis)
    .bind(now)
    .bind(&job_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(ApiDocAppendResult {
        module_count: added_modules,
        api_count: added_apis,
    })
}

#[tauri::command]
pub async fn api_doc_finish_job(
    store: State<'_, ApiDocStore>,
    job_id: String,
    status: String,
    error: Option<String>,
) -> Result<(), String> {
    let pools = store.pools().await?;
    let normalized = match status.as_str() {
        "completed" | "failed" | "cancelled" => status,
        _ => "completed".to_string(),
    };
    sqlx::query(
        "UPDATE api_doc_jobs SET status = ?1, error = ?2, updated_at = ?3 WHERE id = ?4",
    )
    .bind(normalized)
    .bind(error)
    .bind(now_millis())
    .bind(job_id)
    .execute(&pools.writer)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn job_from_row(row: SqliteRow) -> ApiDocJob {
    ApiDocJob {
        id: row.get("id"),
        project_path: row.get("project_path"),
        language: row.get("language"),
        status: row.get("status"),
        total_files: row.get("total_files"),
        processed_files: row.get("processed_files"),
        source_bytes: row.get("source_bytes"),
        module_count: row.get("module_count"),
        api_count: row.get("api_count"),
        error: row.get("error"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

#[tauri::command]
pub async fn api_doc_get_job(
    store: State<'_, ApiDocStore>,
    job_id: String,
) -> Result<Option<ApiDocJob>, String> {
    let pools = store.pools().await?;
    let row = sqlx::query("SELECT * FROM api_doc_jobs WHERE id = ?1")
        .bind(job_id)
        .fetch_optional(&pools.readers)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.map(job_from_row))
}

#[tauri::command]
pub async fn api_doc_list_modules(
    store: State<'_, ApiDocStore>,
    job_id: String,
) -> Result<Vec<ApiDocModuleRecord>, String> {
    let pools = store.pools().await?;
    let rows = sqlx::query(
        r#"
        SELECT id, name, class_name, base_path, module_path, file, api_count, method_stats_json
        FROM api_doc_modules WHERE job_id = ?1 ORDER BY order_index
        "#,
    )
    .bind(job_id)
    .fetch_all(&pools.readers)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| ApiDocModuleRecord {
            id: row.get("id"),
            name: row.get("name"),
            class_name: row.get("class_name"),
            base_path: row.get("base_path"),
            module_path: row.get("module_path"),
            file: row.get("file"),
            api_count: row.get("api_count"),
            method_stats: parse_json(row.get::<String, _>("method_stats_json"), json!({})),
        })
        .collect())
}

fn parse_json(raw: String, fallback: Value) -> Value {
    serde_json::from_str(&raw).unwrap_or(fallback)
}

fn body_from_row(
    row: &SqliteRow,
    prefix: &str,
) -> Option<ApiDocBodyRecord> {
    let id: Option<i64> = row.get(format!("{prefix}_schema_id").as_str());
    id.map(|schema_id| {
        let type_name: Option<String> = row.get(format!("{prefix}_type_name").as_str());
        let fields_json: Option<String> = row.get(format!("{prefix}_fields_json").as_str());
        let example_json: Option<String> = row.get(format!("{prefix}_example_json").as_str());
        ApiDocBodyRecord {
            schema_id,
            body_type: type_name.unwrap_or_default(),
            fields: parse_json(fields_json.unwrap_or_else(|| "[]".to_string()), json!([])),
            example: example_json.and_then(|value| serde_json::from_str(&value).ok()),
        }
    })
}

fn api_from_row(row: SqliteRow) -> ApiDocApiRecord {
    let request_body = body_from_row(&row, "request");
    let response = body_from_row(&row, "response");
    ApiDocApiRecord {
        id: row.get("id"),
        module_id: row.get("module_id"),
        module_name: row.get("module_name"),
        module_class_name: row.get("module_class_name"),
        module_base_path: row.get("module_base_path"),
        module_path: row.get("module_path"),
        module_file: row.get("module_file"),
        method: row.get("method"),
        path: row.get("path"),
        summary: row.get("summary"),
        description: row.get("description"),
        method_name: row.get("method_name"),
        params: parse_json(row.get::<String, _>("params_json"), json!([])),
        request_body,
        response,
    }
}

#[tauri::command]
pub async fn api_doc_query_apis(
    store: State<'_, ApiDocStore>,
    job_id: String,
    module_id: Option<i64>,
    class_names: Vec<String>,
    limit: i64,
    offset: i64,
) -> Result<ApiDocPage, String> {
    let pools = store.pools().await?;
    let safe_limit = limit.clamp(1, MAX_QUERY_LIMIT);
    let safe_offset = offset.max(0);
    let mut query = QueryBuilder::<Sqlite>::new(
        r#"
        SELECT
          a.id, a.module_id, a.method, a.path, a.summary, a.description,
          a.method_name, a.params_json,
          m.name AS module_name, m.class_name AS module_class_name,
          m.base_path AS module_base_path, m.module_path, m.file AS module_file,
          req.id AS request_schema_id, req.type_name AS request_type_name,
          req.fields_json AS request_fields_json, req.example_json AS request_example_json,
          res.id AS response_schema_id, res.type_name AS response_type_name,
          res.fields_json AS response_fields_json, res.example_json AS response_example_json
        FROM api_doc_apis a
        JOIN api_doc_modules m ON m.id = a.module_id
        LEFT JOIN api_doc_schemas req ON req.id = a.request_schema_id
        LEFT JOIN api_doc_schemas res ON res.id = a.response_schema_id
        WHERE a.job_id =
        "#,
    );
    query.push_bind(&job_id);
    if let Some(id) = module_id {
        query.push(" AND a.module_id = ").push_bind(id);
    } else if !class_names.is_empty() {
        query.push(" AND m.class_name IN (");
        let mut separated = query.separated(", ");
        for class_name in &class_names {
            separated.push_bind(class_name);
        }
        separated.push_unseparated(")");
    }
    query
        .push(" ORDER BY m.order_index, a.order_index LIMIT ")
        .push_bind(safe_limit)
        .push(" OFFSET ")
        .push_bind(safe_offset);

    let rows = query
        .build()
        .fetch_all(&pools.readers)
        .await
        .map_err(|e| e.to_string())?;
    Ok(ApiDocPage {
        items: rows.into_iter().map(api_from_row).collect(),
        limit: safe_limit,
        offset: safe_offset,
    })
}

#[tauri::command]
pub async fn api_doc_update_apis(
    store: State<'_, ApiDocStore>,
    job_id: String,
    apis: Vec<ApiDocApiInput>,
) -> Result<(), String> {
    let pools = store.pools().await?;
    let mut tx = pools.writer.begin().await.map_err(|e| e.to_string())?;
    for api in apis {
        let Some(id) = api.id else { continue };
        let params_json = serde_json::to_string(&api.params).map_err(|e| e.to_string())?;
        sqlx::query(
            r#"
            UPDATE api_doc_apis SET summary = ?1, description = ?2, params_json = ?3
            WHERE id = ?4 AND job_id = ?5
            "#,
        )
        .bind(&api.summary)
        .bind(&api.description)
        .bind(params_json)
        .bind(id)
        .bind(&job_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        for body in [api.request_body.as_ref(), api.response.as_ref()].into_iter().flatten() {
            let fields_json = serde_json::to_string(&body.fields).map_err(|e| e.to_string())?;
            let example_json = body
                .example
                .as_ref()
                .map(serde_json::to_string)
                .transpose()
                .map_err(|e| e.to_string())?;
            sqlx::query(
                r#"
                UPDATE api_doc_schemas SET fields_json = ?1, example_json = ?2
                WHERE job_id = ?3 AND type_name = ?4
                "#,
            )
            .bind(fields_json)
            .bind(example_json)
            .bind(&job_id)
            .bind(&body.body_type)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn api_doc_delete_job(
    store: State<'_, ApiDocStore>,
    job_id: String,
) -> Result<(), String> {
    let pools = store.pools().await?;
    sqlx::query("DELETE FROM api_doc_jobs WHERE id = ?1")
        .bind(job_id)
        .execute(&pools.writer)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
