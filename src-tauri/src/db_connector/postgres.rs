use super::{ColumnInfo, DbConfig, DbSchema, ForeignKeyInfo, IndexInfo, TableInfo};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgSslMode};
use sqlx::Row;

fn pg_options(config: &DbConfig) -> PgConnectOptions {
    let db = config.db_name();
    let target = if db.is_empty() { "postgres" } else { db };
    PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password)
        .database(target)
        .ssl_mode(PgSslMode::Disable)
}

pub async fn test_and_list(config: &DbConfig) -> Result<(String, Vec<String>), String> {
    tokio::time::timeout(std::time::Duration::from_secs(8), async {
        use sqlx::ConnectOptions;
        let mut conn = pg_options(config)
            .connect()
            .await
            .map_err(|e| format!("PostgreSQL 连接失败: {}", e))?;

        let row: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&mut conn)
            .await
            .map_err(|e| format!("查询版本失败: {}", e))?;

        let db_rows = sqlx::query(
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
        )
        .fetch_all(&mut conn)
        .await
        .map_err(|e| format!("查询数据库列表失败: {}", e))?;

        let dbs: Vec<String> = db_rows.iter().map(|r| r.get::<String, _>("datname")).collect();
        drop(conn);
        Ok((row.0, dbs))
    })
    .await
    .map_err(|_| "连接超时（8秒），请检查连接参数".to_string())?
}

pub async fn fetch_databases(config: &DbConfig) -> Result<Vec<String>, String> {
    tokio::time::timeout(std::time::Duration::from_secs(8), async {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect_with(pg_options(config))
            .await
            .map_err(|e| format!("PostgreSQL 连接失败: {}", e))?;
        let rows = sqlx::query(
            "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname",
        )
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("查询数据库列表失败: {}", e))?;
        pool.close().await;
        let dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>("datname")).collect();
        Ok(dbs)
    })
    .await
    .map_err(|_| "连接超时（8秒），请检查连接参数".to_string())?
}

pub async fn fetch_schema(config: &DbConfig) -> Result<DbSchema, String> {
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .connect_with(pg_options(config))
        .await
        .map_err(|e| format!("PostgreSQL 连接失败: {}", e))?;

    let table_rows = sqlx::query(
        "SELECT c.relname AS table_name, \
                COALESCE(d.description, '') AS table_comment, \
                c.reltuples::bigint AS row_count \
         FROM pg_class c \
         JOIN pg_namespace n ON n.oid = c.relnamespace \
         LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0 \
         WHERE n.nspname = 'public' AND c.relkind = 'r' \
         ORDER BY c.relname",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询表信息失败: {}", e))?;

    let mut tables = Vec::new();
    for row in &table_rows {
        let name: String = row.get("table_name");
        let comment: String = row.get("table_comment");
        let row_count: Option<i64> = row.try_get("row_count").ok();
        tables.push(TableInfo { name, comment, row_count });
    }

    let col_rows = sqlx::query(
        "SELECT c.table_name, c.column_name, c.data_type, c.udt_name, \
                c.is_nullable, c.column_default, \
                COALESCE(pgd.description, '') AS column_comment, \
                c.ordinal_position::int AS ordinal_position, \
                CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_pk \
         FROM information_schema.columns c \
         LEFT JOIN pg_catalog.pg_statio_all_tables st \
           ON st.schemaname = c.table_schema AND st.relname = c.table_name \
         LEFT JOIN pg_catalog.pg_description pgd \
           ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position \
         LEFT JOIN information_schema.key_column_usage kcu \
           ON kcu.table_schema = c.table_schema \
           AND kcu.table_name = c.table_name \
           AND kcu.column_name = c.column_name \
         LEFT JOIN information_schema.table_constraints tc \
           ON tc.constraint_name = kcu.constraint_name \
           AND tc.table_schema = kcu.table_schema \
           AND tc.constraint_type = 'PRIMARY KEY' \
         WHERE c.table_schema = 'public' \
         ORDER BY c.table_name, c.ordinal_position",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询列信息失败: {}", e))?;

    let mut columns = Vec::new();
    for row in &col_rows {
        let table_name: String = row.get("table_name");
        let name: String = row.get("column_name");
        let data_type: String = row.get("data_type");
        let udt_name: String = row.get("udt_name");
        let nullable_str: String = row.get("is_nullable");
        let is_nullable = nullable_str == "YES";
        let default_value: Option<String> = row.get("column_default");
        let comment: String = row.get("column_comment");
        let is_pk: bool = row.get("is_pk");
        let ordinal: i32 = row.get("ordinal_position");

        columns.push(ColumnInfo {
            table_name,
            name,
            data_type: data_type.clone(),
            full_type: format_pg_type(&data_type, &udt_name),
            is_nullable,
            default_value,
            comment,
            is_primary_key: is_pk,
            ordinal_position: ordinal,
        });
    }

    let fk_rows = sqlx::query(
        "SELECT tc.constraint_name, \
                kcu.table_name, \
                kcu.column_name, \
                ccu.table_name AS ref_table, \
                ccu.column_name AS ref_column \
         FROM information_schema.table_constraints tc \
         JOIN information_schema.key_column_usage kcu \
           ON tc.constraint_name = kcu.constraint_name \
           AND tc.table_schema = kcu.table_schema \
         JOIN information_schema.constraint_column_usage ccu \
           ON ccu.constraint_name = tc.constraint_name \
           AND ccu.table_schema = tc.table_schema \
         WHERE tc.constraint_type = 'FOREIGN KEY' \
           AND tc.table_schema = 'public' \
         ORDER BY kcu.table_name, tc.constraint_name",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询外键失败: {}", e))?;

    let mut foreign_keys = Vec::new();
    for row in &fk_rows {
        foreign_keys.push(ForeignKeyInfo {
            name: row.get("constraint_name"),
            table_name: row.get("table_name"),
            column_name: row.get("column_name"),
            ref_table: row.get("ref_table"),
            ref_column: row.get("ref_column"),
        });
    }

    let idx_rows = sqlx::query(
        "SELECT t.relname AS table_name, \
                i.relname AS index_name, \
                a.attname AS column_name, \
                ix.indisunique AS is_unique, \
                ix.indisprimary AS is_primary, \
                array_position(ix.indkey, a.attnum) AS col_pos \
         FROM pg_index ix \
         JOIN pg_class t ON t.oid = ix.indrelid \
         JOIN pg_class i ON i.oid = ix.indexrelid \
         JOIN pg_namespace n ON n.oid = t.relnamespace \
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey) \
         WHERE n.nspname = 'public' \
         ORDER BY t.relname, i.relname, col_pos",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询索引失败: {}", e))?;

    let mut indexes: Vec<IndexInfo> = Vec::new();
    for row in &idx_rows {
        let table_name: String = row.get("table_name");
        let index_name: String = row.get("index_name");
        let column_name: String = row.get("column_name");
        let is_unique: bool = row.get("is_unique");
        let is_primary: bool = row.get("is_primary");

        if let Some(idx) = indexes
            .iter_mut()
            .find(|i| i.table_name == table_name && i.index_name == index_name)
        {
            idx.columns.push(column_name);
        } else {
            indexes.push(IndexInfo {
                table_name,
                index_name,
                columns: vec![column_name],
                is_unique,
                is_primary,
            });
        }
    }

    pool.close().await;

    Ok(DbSchema { tables, columns, foreign_keys, indexes })
}

fn format_pg_type(data_type: &str, udt_name: &str) -> String {
    match data_type {
        "character varying" => format!("varchar({})", udt_name.replace("varchar", "")),
        "character" => format!("char({})", udt_name.replace("bpchar", "")),
        "USER-DEFINED" => udt_name.to_string(),
        "ARRAY" => format!("{}[]", udt_name.trim_start_matches('_')),
        _ => data_type.to_string(),
    }
}
