use super::{ColumnInfo, DbConfig, DbSchema, ForeignKeyInfo, IndexInfo, TableInfo};
use sqlx::mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlSslMode};
use sqlx::Row;

fn mysql_options(config: &DbConfig) -> MySqlConnectOptions {
    let mut opts = MySqlConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .username(&config.username)
        .password(&config.password)
        .ssl_mode(MySqlSslMode::Disabled);
    let db = config.db_name();
    if !db.is_empty() {
        opts = opts.database(db);
    }
    opts
}

pub async fn test_and_list(config: &DbConfig) -> Result<(String, Vec<String>), String> {
    tokio::time::timeout(std::time::Duration::from_secs(8), async {
        use sqlx::ConnectOptions;
        let mut conn = mysql_options(config)
            .connect()
            .await
            .map_err(|e| format!("MySQL 连接失败: {}", e))?;

        let row: (String,) = sqlx::query_as("SELECT VERSION()")
            .fetch_one(&mut conn)
            .await
            .map_err(|e| format!("查询版本失败: {}", e))?;
        let version = format!("MySQL {}", row.0);

        let db_rows: Vec<(String,)> = sqlx::query_as(
            "SELECT CAST(SCHEMA_NAME AS CHAR) FROM information_schema.SCHEMATA \
             WHERE SCHEMA_NAME NOT IN ('information_schema','performance_schema','sys','mysql') \
             ORDER BY SCHEMA_NAME"
        )
            .fetch_all(&mut conn)
            .await
            .map_err(|e| format!("查询数据库列表失败: {}", e))?;

        let dbs: Vec<String> = db_rows.into_iter().map(|(name,)| name).collect();
        drop(conn);
        Ok((version, dbs))
    })
    .await
    .map_err(|_| "连接超时（8秒），请检查连接参数".to_string())?
}

pub async fn fetch_databases(config: &DbConfig) -> Result<Vec<String>, String> {
    tokio::time::timeout(std::time::Duration::from_secs(8), async {
        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(5))
            .connect_with(mysql_options(config))
            .await
            .map_err(|e| format!("MySQL 连接失败: {}", e))?;
        let rows = sqlx::query("SHOW DATABASES")
            .fetch_all(&pool)
            .await
            .map_err(|e| format!("查询数据库列表失败: {}", e))?;
        pool.close().await;
        let mut dbs: Vec<String> = rows.iter().map(|r| r.get::<String, _>(0)).collect();
        dbs.retain(|d| {
            !matches!(
                d.as_str(),
                "information_schema" | "performance_schema" | "sys"
            )
        });
        dbs.sort();
        Ok(dbs)
    })
    .await
    .map_err(|_| "连接超时（8秒），请检查连接参数".to_string())?
}

pub async fn fetch_schema(config: &DbConfig) -> Result<DbSchema, String> {
    let pool = MySqlPoolOptions::new()
        .max_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .connect_with(mysql_options(config))
        .await
        .map_err(|e| format!("MySQL 连接失败: {}", e))?;

    let db = config.db_name();

    let table_rows = sqlx::query(
        "SELECT CAST(TABLE_NAME AS CHAR) AS TABLE_NAME, \
                CAST(IFNULL(TABLE_COMMENT, '') AS CHAR) AS TABLE_COMMENT, \
                TABLE_ROWS \
         FROM information_schema.TABLES \
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' \
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
        tables.push(TableInfo { name, comment, row_count });
    }

    let col_rows = sqlx::query(
        "SELECT CAST(c.TABLE_NAME AS CHAR) AS TABLE_NAME, \
                CAST(c.COLUMN_NAME AS CHAR) AS COLUMN_NAME, \
                CAST(c.DATA_TYPE AS CHAR) AS DATA_TYPE, \
                CAST(c.COLUMN_TYPE AS CHAR) AS COLUMN_TYPE, \
                CAST(c.IS_NULLABLE AS CHAR) AS IS_NULLABLE, \
                CAST(c.COLUMN_DEFAULT AS CHAR) AS COLUMN_DEFAULT, \
                CAST(IFNULL(c.COLUMN_COMMENT, '') AS CHAR) AS COLUMN_COMMENT, \
                c.ORDINAL_POSITION, \
                IF(kcu.COLUMN_NAME IS NOT NULL, 1, 0) AS IS_PK \
         FROM information_schema.COLUMNS c \
         LEFT JOIN information_schema.KEY_COLUMN_USAGE kcu \
           ON kcu.TABLE_SCHEMA = c.TABLE_SCHEMA \
           AND kcu.TABLE_NAME = c.TABLE_NAME \
           AND kcu.COLUMN_NAME = c.COLUMN_NAME \
           AND kcu.CONSTRAINT_NAME = 'PRIMARY' \
         WHERE c.TABLE_SCHEMA = ? \
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

    let fk_rows = sqlx::query(
        "SELECT CAST(CONSTRAINT_NAME AS CHAR) AS CONSTRAINT_NAME, \
                CAST(TABLE_NAME AS CHAR) AS TABLE_NAME, \
                CAST(COLUMN_NAME AS CHAR) AS COLUMN_NAME, \
                CAST(REFERENCED_TABLE_NAME AS CHAR) AS REFERENCED_TABLE_NAME, \
                CAST(REFERENCED_COLUMN_NAME AS CHAR) AS REFERENCED_COLUMN_NAME \
         FROM information_schema.KEY_COLUMN_USAGE \
         WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL \
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

    let idx_rows = sqlx::query(
        "SELECT CAST(TABLE_NAME AS CHAR) AS TABLE_NAME, \
                CAST(INDEX_NAME AS CHAR) AS INDEX_NAME, \
                CAST(COLUMN_NAME AS CHAR) AS COLUMN_NAME, \
                NON_UNIQUE, SEQ_IN_INDEX \
         FROM information_schema.STATISTICS \
         WHERE TABLE_SCHEMA = ? \
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

    Ok(DbSchema { tables, columns, foreign_keys, indexes })
}
