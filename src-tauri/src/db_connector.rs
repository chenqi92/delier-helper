use serde::{Deserialize, Serialize};
use sqlx::{mysql::MySqlPoolOptions, postgres::PgPoolOptions, Row};

#[derive(Debug, Clone, Deserialize)]
pub struct DbConfig {
    pub db_type: String, // "mysql" | "postgres"
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
}

impl DbConfig {
    fn db_name(&self) -> &str {
        self.database.as_deref().unwrap_or("")
    }

    fn mysql_url(&self) -> String {
        let db = self.db_name();
        if db.is_empty() {
            format!(
                "mysql://{}:{}@{}:{}",
                self.username, self.password, self.host, self.port
            )
        } else {
            format!(
                "mysql://{}:{}@{}:{}/{}",
                self.username, self.password, self.host, self.port, db
            )
        }
    }

    fn postgres_url(&self) -> String {
        let db = self.db_name();
        let target = if db.is_empty() { "postgres" } else { db };
        format!(
            "postgres://{}:{}@{}:{}/{}",
            self.username, self.password, self.host, self.port, target
        )
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct TableInfo {
    pub name: String,
    pub comment: String,
    pub row_count: Option<i64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ColumnInfo {
    pub table_name: String,
    pub name: String,
    pub data_type: String,
    pub full_type: String,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub comment: String,
    pub is_primary_key: bool,
    pub ordinal_position: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct ForeignKeyInfo {
    pub name: String,
    pub table_name: String,
    pub column_name: String,
    pub ref_table: String,
    pub ref_column: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct IndexInfo {
    pub table_name: String,
    pub index_name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
}

#[derive(Debug, Serialize)]
pub struct DbSchema {
    pub tables: Vec<TableInfo>,
    pub columns: Vec<ColumnInfo>,
    pub foreign_keys: Vec<ForeignKeyInfo>,
    pub indexes: Vec<IndexInfo>,
}

/// Test database connection
pub async fn test_connection(config: &DbConfig) -> Result<String, String> {
    if config.db_type == "mysql" {
        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&config.mysql_url())
            .await
            .map_err(|e| format!("MySQL 连接失败: {}", e))?;
        let row: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&pool)
            .await
            .map_err(|e| format!("查询版本失败: {}", e))?;
        pool.close().await;
        Ok(format!("MySQL {}", row.0))
    } else if config.db_type == "postgres" {
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(10))
            .connect(&config.postgres_url())
            .await
            .map_err(|e| format!("PostgreSQL 连接失败: {}", e))?;
        let row: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&pool)
            .await
            .map_err(|e| format!("查询版本失败: {}", e))?;
        pool.close().await;
        Ok(row.0)
    } else {
        Err(format!("不支持的数据库类型: {}", config.db_type))
    }
}

/// Fetch list of databases
pub async fn fetch_databases(config: &DbConfig) -> Result<Vec<String>, String> {
    match config.db_type.as_str() {
        "mysql" => {
            let pool = MySqlPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(std::time::Duration::from_secs(10))
                .connect(&config.mysql_url())
                .await
                .map_err(|e| format!("MySQL 连接失败: {}", e))?;
            let rows = sqlx::query("SHOW DATABASES")
                .fetch_all(&pool)
                .await
                .map_err(|e| format!("查询数据库列表失败: {}", e))?;
            pool.close().await;
            let mut dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
            // 过滤系统库
            dbs.retain(|d| {
                !matches!(
                    d.as_str(),
                    "information_schema" | "performance_schema" | "sys"
                )
            });
            dbs.sort();
            Ok(dbs)
        }
        "postgres" => {
            let pool = PgPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(std::time::Duration::from_secs(10))
                .connect(&config.postgres_url())
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
        }
        _ => Err(format!("不支持的数据库类型: {}", config.db_type)),
    }
}

/// Fetch complete database schema
pub async fn fetch_schema(config: &DbConfig) -> Result<DbSchema, String> {
    if config.db_name().is_empty() {
        return Err("请先选择一个数据库".to_string());
    }
    match config.db_type.as_str() {
        "mysql" => fetch_mysql_schema(config).await,
        "postgres" => fetch_postgres_schema(config).await,
        _ => Err(format!("不支持的数据库类型: {}", config.db_type)),
    }
}

// ==================== MySQL ====================

async fn fetch_mysql_schema(config: &DbConfig) -> Result<DbSchema, String> {
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .connect(&config.mysql_url())
        .await
        .map_err(|e| format!("MySQL 连接失败: {}", e))?;

    let db = config.db_name();

    // 1. Tables
    let table_rows = sqlx::query(
        "SELECT CAST(TABLE_NAME AS CHAR) AS TABLE_NAME,
                CAST(IFNULL(TABLE_COMMENT, '') AS CHAR) AS TABLE_COMMENT,
                TABLE_ROWS
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME",
    )
    .bind(db)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询表信息失败: {}", e))?;

    let mut tables = Vec::new();
    for row in &table_rows {
        let name: String = row.get("TABLE_NAME");
        let comment: String = row.get("TABLE_COMMENT");
        let row_count: Option<i64> = row.try_get("TABLE_ROWS").ok();
        tables.push(TableInfo {
            name,
            comment,
            row_count,
        });
    }

    // 2. Columns with primary key info
    let col_rows = sqlx::query(
        "SELECT CAST(c.TABLE_NAME AS CHAR) AS TABLE_NAME,
                CAST(c.COLUMN_NAME AS CHAR) AS COLUMN_NAME,
                CAST(c.DATA_TYPE AS CHAR) AS DATA_TYPE,
                CAST(c.COLUMN_TYPE AS CHAR) AS COLUMN_TYPE,
                CAST(c.IS_NULLABLE AS CHAR) AS IS_NULLABLE,
                CAST(c.COLUMN_DEFAULT AS CHAR) AS COLUMN_DEFAULT,
                CAST(IFNULL(c.COLUMN_COMMENT, '') AS CHAR) AS COLUMN_COMMENT,
                c.ORDINAL_POSITION,
                IF(kcu.COLUMN_NAME IS NOT NULL, 1, 0) AS IS_PK
         FROM information_schema.COLUMNS c
         LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu
           ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
           AND kcu.TABLE_NAME = c.TABLE_NAME
           AND kcu.COLUMN_NAME = c.COLUMN_NAME
           AND kcu.CONSTRAINT_NAME = 'PRIMARY'
         WHERE c.TABLE_SCHEMA = ?
         ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION",
    )
    .bind(db)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询列信息失败: {}", e))?;

    let mut columns = Vec::new();
    for row in &col_rows {
        let table_name: String = row.get("TABLE_NAME");
        let name: String = row.get("COLUMN_NAME");
        let data_type: String = row.get("DATA_TYPE");
        let full_type: String = row.get("COLUMN_TYPE");
        let nullable_str: String = row.get("IS_NULLABLE");
        let is_nullable = nullable_str == "YES";
        let default_value: Option<String> = row.get("COLUMN_DEFAULT");
        let comment: String = row.get("COLUMN_COMMENT");
        let is_pk: i32 = row.get("IS_PK");
        let ordinal: u32 = row.get("ORDINAL_POSITION");

        columns.push(ColumnInfo {
            table_name,
            name,
            data_type,
            full_type,
            is_nullable,
            default_value,
            comment,
            is_primary_key: is_pk == 1,
            ordinal_position: ordinal as i32,
        });
    }

    // 3. Foreign keys
    let fk_rows = sqlx::query(
        "SELECT CAST(CONSTRAINT_NAME AS CHAR) AS CONSTRAINT_NAME,
                CAST(TABLE_NAME AS CHAR) AS TABLE_NAME,
                CAST(COLUMN_NAME AS CHAR) AS COLUMN_NAME,
                CAST(REFERENCED_TABLE_NAME AS CHAR) AS REFERENCED_TABLE_NAME,
                CAST(REFERENCED_COLUMN_NAME AS CHAR) AS REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY TABLE_NAME, CONSTRAINT_NAME",
    )
    .bind(db)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询外键失败: {}", e))?;

    let mut foreign_keys = Vec::new();
    for row in &fk_rows {
        foreign_keys.push(ForeignKeyInfo {
            name: row.get("CONSTRAINT_NAME"),
            table_name: row.get("TABLE_NAME"),
            column_name: row.get("COLUMN_NAME"),
            ref_table: row.get("REFERENCED_TABLE_NAME"),
            ref_column: row.get("REFERENCED_COLUMN_NAME"),
        });
    }

    // 4. Indexes
    let idx_rows = sqlx::query(
        "SELECT CAST(TABLE_NAME AS CHAR) AS TABLE_NAME,
                CAST(INDEX_NAME AS CHAR) AS INDEX_NAME,
                CAST(COLUMN_NAME AS CHAR) AS COLUMN_NAME,
                NON_UNIQUE, SEQ_IN_INDEX
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
    )
    .bind(db)
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("查询索引失败: {}", e))?;

    let mut indexes: Vec<IndexInfo> = Vec::new();
    for row in &idx_rows {
        let table_name: String = row.get("TABLE_NAME");
        let index_name: String = row.get("INDEX_NAME");
        let column_name: String = row.get("COLUMN_NAME");
        let non_unique: i32 = row.get("NON_UNIQUE");
        let is_primary = index_name == "PRIMARY";

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
                is_unique: non_unique == 0,
                is_primary,
            });
        }
    }

    pool.close().await;

    Ok(DbSchema {
        tables,
        columns,
        foreign_keys,
        indexes,
    })
}

// ==================== PostgreSQL ====================

async fn fetch_postgres_schema(config: &DbConfig) -> Result<DbSchema, String> {
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .connect(&config.postgres_url())
        .await
        .map_err(|e| format!("PostgreSQL 连接失败: {}", e))?;

    // 1. Tables
    let table_rows = sqlx::query(
        "SELECT c.relname AS table_name,
                COALESCE(d.description, '') AS table_comment,
                c.reltuples::bigint AS row_count
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = 0
         WHERE n.nspname = 'public' AND c.relkind = 'r'
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
        tables.push(TableInfo {
            name,
            comment,
            row_count,
        });
    }

    // 2. Columns
    let col_rows = sqlx::query(
        "SELECT c.table_name, c.column_name, c.data_type, c.udt_name,
                c.is_nullable, c.column_default,
                COALESCE(pgd.description, '') AS column_comment,
                c.ordinal_position::int AS ordinal_position,
                CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_pk
         FROM information_schema.columns c
         LEFT JOIN pg_catalog.pg_statio_all_tables st
           ON st.schemaname = c.table_schema AND st.relname = c.table_name
         LEFT JOIN pg_catalog.pg_description pgd
           ON pgd.objoid = st.relid AND pgd.objsubid = c.ordinal_position
         LEFT JOIN information_schema.key_column_usage kcu
           ON kcu.table_schema = c.table_schema
           AND kcu.table_name = c.table_name
           AND kcu.column_name = c.column_name
         LEFT JOIN information_schema.table_constraints tc
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
           AND tc.constraint_type = 'PRIMARY KEY'
         WHERE c.table_schema = 'public'
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

    // 3. Foreign keys
    let fk_rows = sqlx::query(
        "SELECT tc.constraint_name,
                kcu.table_name,
                kcu.column_name,
                ccu.table_name AS ref_table,
                ccu.column_name AS ref_column
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
         WHERE tc.constraint_type = 'FOREIGN KEY'
           AND tc.table_schema = 'public'
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

    // 4. Indexes
    let idx_rows = sqlx::query(
        "SELECT t.relname AS table_name,
                i.relname AS index_name,
                a.attname AS column_name,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                array_position(ix.indkey, a.attnum) AS col_pos
         FROM pg_index ix
         JOIN pg_class t ON t.oid = ix.indrelid
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
         WHERE n.nspname = 'public'
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

    Ok(DbSchema {
        tables,
        columns,
        foreign_keys,
        indexes,
    })
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
