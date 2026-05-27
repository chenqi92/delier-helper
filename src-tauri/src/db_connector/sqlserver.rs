use super::{ColumnInfo, DbConfig, DbSchema, ForeignKeyInfo, IndexInfo, TableInfo};
use tiberius::{AuthMethod, Client, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio_util::compat::{Compat, TokioAsyncWriteCompatExt};

type MssqlClient = Client<Compat<TcpStream>>;

async fn connect(config: &DbConfig) -> Result<MssqlClient, String> {
    let mut cfg = Config::new();
    cfg.host(&config.host);
    cfg.port(config.port);
    cfg.authentication(AuthMethod::sql_server(&config.username, &config.password));
    cfg.encryption(EncryptionLevel::Required);
    cfg.trust_cert();
    let db = config.db_name();
    if !db.is_empty() {
        cfg.database(db);
    }

    let tcp = TcpStream::connect(cfg.get_addr())
        .await
        .map_err(|e| format!("SQL Server TCP 连接失败: {}", e))?;
    tcp.set_nodelay(true).ok();
    let client = Client::connect(cfg, tcp.compat_write())
        .await
        .map_err(|e| format!("SQL Server 握手失败: {}", e))?;
    Ok(client)
}

pub async fn test_and_list(config: &DbConfig) -> Result<(String, Vec<String>), String> {
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        let mut client = connect(config).await?;

        let ver_rows = client
            .simple_query("SELECT @@VERSION")
            .await
            .map_err(|e| format!("查询版本失败: {}", e))?
            .into_first_result()
            .await
            .map_err(|e| format!("读取版本失败: {}", e))?;
        let version = ver_rows
            .first()
            .and_then(|r| r.get::<&str, _>(0))
            .map(|s| {
                let trimmed: String = s.lines().next().unwrap_or(s).trim().to_string();
                if trimmed.is_empty() { "SQL Server".to_string() } else { trimmed }
            })
            .unwrap_or_else(|| "SQL Server".to_string());

        let db_rows = client
            .simple_query(
                "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name",
            )
            .await
            .map_err(|e| format!("查询数据库列表失败: {}", e))?
            .into_first_result()
            .await
            .map_err(|e| format!("读取数据库列表失败: {}", e))?;
        let dbs: Vec<String> = db_rows
            .iter()
            .filter_map(|r| r.get::<&str, _>(0).map(|s| s.to_string()))
            .collect();
        Ok((version, dbs))
    })
    .await
    .map_err(|_| "连接超时（10秒），请检查连接参数".to_string())?
}

pub async fn fetch_databases(config: &DbConfig) -> Result<Vec<String>, String> {
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        let mut client = connect(config).await?;
        let rows = client
            .simple_query(
                "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name",
            )
            .await
            .map_err(|e| format!("查询数据库列表失败: {}", e))?
            .into_first_result()
            .await
            .map_err(|e| format!("读取数据库列表失败: {}", e))?;
        Ok(rows
            .iter()
            .filter_map(|r| r.get::<&str, _>(0).map(|s| s.to_string()))
            .collect())
    })
    .await
    .map_err(|_| "连接超时（10秒），请检查连接参数".to_string())?
}

pub async fn fetch_schema(config: &DbConfig) -> Result<DbSchema, String> {
    let mut client = connect(config).await?;

    // Tables
    let table_rows = client
        .simple_query(
            "SELECT t.name AS table_name, \
                    ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS table_comment, \
                    ISNULL(p.rows, 0) AS row_count \
             FROM sys.tables t \
             LEFT JOIN sys.extended_properties ep \
               ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description' \
             LEFT JOIN ( \
                SELECT object_id, MAX(rows) AS rows \
                FROM sys.partitions \
                WHERE index_id IN (0, 1) \
                GROUP BY object_id \
             ) p ON p.object_id = t.object_id \
             ORDER BY t.name",
        )
        .await
        .map_err(|e| format!("查询表信息失败: {}", e))?
        .into_first_result()
        .await
        .map_err(|e| format!("读取表信息失败: {}", e))?;

    let mut tables = Vec::new();
    for row in &table_rows {
        let name = row.get::<&str, _>("table_name").unwrap_or("").to_string();
        let comment = row.get::<&str, _>("table_comment").unwrap_or("").to_string();
        let row_count: Option<i64> = row.get::<i64, _>("row_count");
        tables.push(TableInfo { name, comment, row_count });
    }

    // Columns
    let col_rows = client
        .simple_query(
            "SELECT t.name AS table_name, \
                    c.name AS column_name, \
                    ty.name AS data_type, \
                    c.max_length, \
                    c.precision, \
                    c.scale, \
                    c.is_nullable, \
                    OBJECT_DEFINITION(c.default_object_id) AS column_default, \
                    ISNULL(CAST(ep.value AS NVARCHAR(MAX)), '') AS column_comment, \
                    c.column_id AS ordinal_position, \
                    CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_pk \
             FROM sys.columns c \
             INNER JOIN sys.tables t ON t.object_id = c.object_id \
             INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id \
             LEFT JOIN sys.extended_properties ep \
               ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description' \
             LEFT JOIN ( \
                SELECT ic.object_id, ic.column_id \
                FROM sys.indexes i \
                INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id \
                WHERE i.is_primary_key = 1 \
             ) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id \
             ORDER BY t.name, c.column_id",
        )
        .await
        .map_err(|e| format!("查询列信息失败: {}", e))?
        .into_first_result()
        .await
        .map_err(|e| format!("读取列信息失败: {}", e))?;

    let mut columns = Vec::new();
    for row in &col_rows {
        let table_name = row.get::<&str, _>("table_name").unwrap_or("").to_string();
        let name = row.get::<&str, _>("column_name").unwrap_or("").to_string();
        let data_type = row.get::<&str, _>("data_type").unwrap_or("").to_string();
        let max_length: i16 = row.get::<i16, _>("max_length").unwrap_or(0);
        let precision: u8 = row.get::<u8, _>("precision").unwrap_or(0);
        let scale: u8 = row.get::<u8, _>("scale").unwrap_or(0);
        let is_nullable = row.get::<bool, _>("is_nullable").unwrap_or(true);
        let default_value: Option<String> =
            row.get::<&str, _>("column_default").map(|s| s.to_string());
        let comment = row.get::<&str, _>("column_comment").unwrap_or("").to_string();
        let ordinal: i32 = row.get::<i32, _>("ordinal_position").unwrap_or(0);
        let is_pk: i32 = row.get::<i32, _>("is_pk").unwrap_or(0);

        columns.push(ColumnInfo {
            table_name,
            name,
            full_type: format_mssql_type(&data_type, max_length, precision, scale),
            data_type,
            is_nullable,
            default_value,
            comment,
            is_primary_key: is_pk == 1,
            ordinal_position: ordinal,
        });
    }

    // Foreign keys
    let fk_rows = client
        .simple_query(
            "SELECT fk.name AS constraint_name, \
                    OBJECT_NAME(fk.parent_object_id) AS table_name, \
                    COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name, \
                    OBJECT_NAME(fk.referenced_object_id) AS ref_table, \
                    COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ref_column \
             FROM sys.foreign_keys fk \
             INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id \
             ORDER BY OBJECT_NAME(fk.parent_object_id), fk.name",
        )
        .await
        .map_err(|e| format!("查询外键失败: {}", e))?
        .into_first_result()
        .await
        .map_err(|e| format!("读取外键失败: {}", e))?;

    let mut foreign_keys = Vec::new();
    for row in &fk_rows {
        foreign_keys.push(ForeignKeyInfo {
            name: row.get::<&str, _>("constraint_name").unwrap_or("").to_string(),
            table_name: row.get::<&str, _>("table_name").unwrap_or("").to_string(),
            column_name: row.get::<&str, _>("column_name").unwrap_or("").to_string(),
            ref_table: row.get::<&str, _>("ref_table").unwrap_or("").to_string(),
            ref_column: row.get::<&str, _>("ref_column").unwrap_or("").to_string(),
        });
    }

    // Indexes
    let idx_rows = client
        .simple_query(
            "SELECT OBJECT_NAME(i.object_id) AS table_name, \
                    i.name AS index_name, \
                    c.name AS column_name, \
                    CAST(CASE WHEN i.is_unique = 1 THEN 1 ELSE 0 END AS INT) AS is_unique, \
                    CAST(CASE WHEN i.is_primary_key = 1 THEN 1 ELSE 0 END AS INT) AS is_primary, \
                    ic.key_ordinal AS col_pos \
             FROM sys.indexes i \
             INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id \
             INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id \
             INNER JOIN sys.tables t ON t.object_id = i.object_id \
             WHERE i.index_id > 0 \
             ORDER BY OBJECT_NAME(i.object_id), i.name, ic.key_ordinal",
        )
        .await
        .map_err(|e| format!("查询索引失败: {}", e))?
        .into_first_result()
        .await
        .map_err(|e| format!("读取索引失败: {}", e))?;

    let mut indexes: Vec<IndexInfo> = Vec::new();
    for row in &idx_rows {
        let table_name = row.get::<&str, _>("table_name").unwrap_or("").to_string();
        let index_name = row.get::<&str, _>("index_name").unwrap_or("").to_string();
        let column_name = row.get::<&str, _>("column_name").unwrap_or("").to_string();
        let is_unique: i32 = row.get::<i32, _>("is_unique").unwrap_or(0);
        let is_primary: i32 = row.get::<i32, _>("is_primary").unwrap_or(0);

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
                is_unique: is_unique == 1,
                is_primary: is_primary == 1,
            });
        }
    }

    Ok(DbSchema { tables, columns, foreign_keys, indexes })
}

fn format_mssql_type(data_type: &str, max_length: i16, precision: u8, scale: u8) -> String {
    let lower = data_type.to_lowercase();
    match lower.as_str() {
        "varchar" | "char" | "varbinary" | "binary" => {
            if max_length == -1 {
                format!("{}(max)", data_type)
            } else {
                format!("{}({})", data_type, max_length)
            }
        }
        "nvarchar" | "nchar" => {
            if max_length == -1 {
                format!("{}(max)", data_type)
            } else {
                format!("{}({})", data_type, max_length / 2)
            }
        }
        "decimal" | "numeric" => format!("{}({},{})", data_type, precision, scale),
        _ => data_type.to_string(),
    }
}
