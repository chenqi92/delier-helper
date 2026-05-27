use super::{ColumnInfo, DbConfig, DbSchema, ForeignKeyInfo, IndexInfo, TableInfo};
use oracle::Connection;

fn build_connect_string(config: &DbConfig) -> Result<String, String> {
    let service = config.db_name();
    if service.is_empty() {
        return Err("Oracle 需要在「数据库名」字段填写 Service Name 或 SID".to_string());
    }
    Ok(format!("//{}:{}/{}", config.host, config.port, service))
}

fn open(config: &DbConfig) -> Result<Connection, String> {
    let cs = build_connect_string(config)?;
    Connection::connect(&config.username, &config.password, &cs)
        .map_err(|e| format!("Oracle 连接失败: {}（请确认已安装 Oracle Instant Client）", e))
}

pub async fn test_and_list(config: &DbConfig) -> Result<(String, Vec<String>), String> {
    let cfg = config.clone();
    tokio::task::spawn_blocking(move || -> Result<(String, Vec<String>), String> {
        let conn = open(&cfg)?;

        let mut version = String::from("Oracle");
        if let Ok(mut rs) = conn.query("SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1", &[]) {
            if let Some(Ok(row)) = rs.next() {
                if let Ok(s) = row.get::<usize, String>(0) {
                    version = s.trim().to_string();
                }
            }
        }

        // Oracle 的连接 target 是 service name，不是 mysql/pg 那种"数据库列表"
        // 这里返回当前 service 自身，保持 UI 下拉框值不变
        let service = cfg.db_name().to_string();
        Ok((version, vec![service]))
    })
    .await
    .map_err(|e| format!("Oracle 任务失败: {}", e))?
}

pub async fn fetch_databases(config: &DbConfig) -> Result<Vec<String>, String> {
    let cfg = config.clone();
    tokio::task::spawn_blocking(move || -> Result<Vec<String>, String> {
        let _conn = open(&cfg)?;
        Ok(vec![cfg.db_name().to_string()])
    })
    .await
    .map_err(|e| format!("Oracle 任务失败: {}", e))?
}

pub async fn fetch_schema(config: &DbConfig) -> Result<DbSchema, String> {
    let cfg = config.clone();
    tokio::task::spawn_blocking(move || -> Result<DbSchema, String> {
        let conn = open(&cfg)?;
        // 用户填写的 database 字段在 Oracle 语义里既可表示 service name，也可表示要扫描的 schema (owner)
        // 这里取连接的当前用户作为 owner — 简化逻辑、与 USER_* 视图一致
        let owner_query = "SELECT USER FROM dual";
        let mut owner: String = cfg.username.to_uppercase();
        if let Ok(mut rs) = conn.query(owner_query, &[]) {
            if let Some(Ok(row)) = rs.next() {
                if let Ok(s) = row.get::<usize, String>(0) {
                    owner = s;
                }
            }
        }

        // Tables
        let mut tables = Vec::new();
        let table_sql =
            "SELECT t.table_name, NVL(c.comments, '') AS table_comment, t.num_rows \
             FROM user_tables t \
             LEFT JOIN user_tab_comments c ON c.table_name = t.table_name \
             WHERE t.table_name NOT LIKE 'BIN$%' \
             ORDER BY t.table_name";
        let rs = conn
            .query(table_sql, &[])
            .map_err(|e| format!("查询表信息失败: {}", e))?;
        for row in rs.flatten() {
            let name: String = row.get::<&str, String>("TABLE_NAME").unwrap_or_default();
            let comment: String = row
                .get::<&str, String>("TABLE_COMMENT")
                .unwrap_or_default();
            let row_count: Option<i64> = row.get::<&str, Option<i64>>("NUM_ROWS").ok().flatten();
            tables.push(TableInfo { name, comment, row_count });
        }

        // Columns
        let mut columns = Vec::new();
        let col_sql =
            "SELECT c.table_name, c.column_name, c.data_type, \
                    c.data_length, c.data_precision, c.data_scale, \
                    c.nullable, \
                    NVL(cc.comments, '') AS column_comment, \
                    c.column_id, \
                    CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS is_pk \
             FROM user_tab_columns c \
             LEFT JOIN user_col_comments cc \
               ON cc.table_name = c.table_name AND cc.column_name = c.column_name \
             LEFT JOIN ( \
                SELECT cons.table_name, cols.column_name \
                FROM user_constraints cons \
                JOIN user_cons_columns cols ON cols.constraint_name = cons.constraint_name \
                WHERE cons.constraint_type = 'P' \
             ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name \
             WHERE c.table_name NOT LIKE 'BIN$%' \
             ORDER BY c.table_name, c.column_id";
        let rs = conn
            .query(col_sql, &[])
            .map_err(|e| format!("查询列信息失败: {}", e))?;
        for row in rs.flatten() {
            let table_name: String = row.get::<&str, String>("TABLE_NAME").unwrap_or_default();
            let name: String = row.get::<&str, String>("COLUMN_NAME").unwrap_or_default();
            let data_type: String = row.get::<&str, String>("DATA_TYPE").unwrap_or_default();
            let data_length: Option<i64> = row.get::<&str, Option<i64>>("DATA_LENGTH").ok().flatten();
            let data_precision: Option<i64> =
                row.get::<&str, Option<i64>>("DATA_PRECISION").ok().flatten();
            let data_scale: Option<i64> = row.get::<&str, Option<i64>>("DATA_SCALE").ok().flatten();
            let nullable: String = row.get::<&str, String>("NULLABLE").unwrap_or_default();
            let comment: String = row
                .get::<&str, String>("COLUMN_COMMENT")
                .unwrap_or_default();
            let ordinal: Option<i64> = row.get::<&str, Option<i64>>("COLUMN_ID").ok().flatten();
            let is_pk: i64 = row.get::<&str, i64>("IS_PK").unwrap_or(0);

            columns.push(ColumnInfo {
                table_name,
                name,
                full_type: format_oracle_type(&data_type, data_length, data_precision, data_scale),
                data_type,
                is_nullable: nullable == "Y",
                default_value: None,
                comment,
                is_primary_key: is_pk == 1,
                ordinal_position: ordinal.unwrap_or(0) as i32,
            });
        }

        // Foreign keys
        let mut foreign_keys = Vec::new();
        let fk_sql =
            "SELECT fk.constraint_name, \
                    fk.table_name, \
                    fcols.column_name, \
                    pk.table_name AS ref_table, \
                    pcols.column_name AS ref_column \
             FROM user_constraints fk \
             JOIN user_cons_columns fcols ON fcols.constraint_name = fk.constraint_name \
             JOIN user_constraints pk ON pk.constraint_name = fk.r_constraint_name \
             JOIN user_cons_columns pcols \
               ON pcols.constraint_name = pk.constraint_name AND pcols.position = fcols.position \
             WHERE fk.constraint_type = 'R' \
             ORDER BY fk.table_name, fk.constraint_name, fcols.position";
        let rs = conn
            .query(fk_sql, &[])
            .map_err(|e| format!("查询外键失败: {}", e))?;
        for row in rs.flatten() {
            foreign_keys.push(ForeignKeyInfo {
                name: row.get::<&str, String>("CONSTRAINT_NAME").unwrap_or_default(),
                table_name: row.get::<&str, String>("TABLE_NAME").unwrap_or_default(),
                column_name: row.get::<&str, String>("COLUMN_NAME").unwrap_or_default(),
                ref_table: row.get::<&str, String>("REF_TABLE").unwrap_or_default(),
                ref_column: row.get::<&str, String>("REF_COLUMN").unwrap_or_default(),
            });
        }

        // Indexes
        let mut indexes: Vec<IndexInfo> = Vec::new();
        let idx_sql =
            "SELECT i.table_name, \
                    i.index_name, \
                    ic.column_name, \
                    i.uniqueness, \
                    CASE WHEN c.constraint_type = 'P' THEN 1 ELSE 0 END AS is_primary, \
                    ic.column_position \
             FROM user_indexes i \
             JOIN user_ind_columns ic ON ic.index_name = i.index_name \
             LEFT JOIN user_constraints c \
               ON c.constraint_name = i.index_name AND c.constraint_type = 'P' \
             WHERE i.table_name NOT LIKE 'BIN$%' \
             ORDER BY i.table_name, i.index_name, ic.column_position";
        let rs = conn
            .query(idx_sql, &[])
            .map_err(|e| format!("查询索引失败: {}", e))?;
        for row in rs.flatten() {
            let table_name: String = row.get::<&str, String>("TABLE_NAME").unwrap_or_default();
            let index_name: String = row.get::<&str, String>("INDEX_NAME").unwrap_or_default();
            let column_name: String = row.get::<&str, String>("COLUMN_NAME").unwrap_or_default();
            let uniqueness: String = row.get::<&str, String>("UNIQUENESS").unwrap_or_default();
            let is_primary: i64 = row.get::<&str, i64>("IS_PRIMARY").unwrap_or(0);

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
                    is_unique: uniqueness == "UNIQUE",
                    is_primary: is_primary == 1,
                });
            }
        }

        let _ = owner;
        Ok(DbSchema { tables, columns, foreign_keys, indexes })
    })
    .await
    .map_err(|e| format!("Oracle 任务失败: {}", e))?
}

fn format_oracle_type(
    data_type: &str,
    data_length: Option<i64>,
    data_precision: Option<i64>,
    data_scale: Option<i64>,
) -> String {
    let lower = data_type.to_lowercase();
    match lower.as_str() {
        "varchar2" | "varchar" | "char" | "nvarchar2" | "nchar" => {
            data_length
                .map(|n| format!("{}({})", data_type, n))
                .unwrap_or_else(|| data_type.to_string())
        }
        "number" => match (data_precision, data_scale) {
            (Some(p), Some(s)) if s > 0 => format!("number({},{})", p, s),
            (Some(p), _) => format!("number({})", p),
            _ => data_type.to_string(),
        },
        "float" => data_precision
            .map(|p| format!("float({})", p))
            .unwrap_or_else(|| data_type.to_string()),
        _ => data_type.to_string(),
    }
}
