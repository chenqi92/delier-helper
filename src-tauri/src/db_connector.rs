use serde::{Deserialize, Serialize};

mod mysql;
mod oracle;
mod postgres;
mod sqlserver;

#[derive(Debug, Clone, Deserialize)]
pub struct DbConfig {
    pub db_type: String, // "mysql" | "postgres" | "sqlserver" | "oracle"
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
}

impl DbConfig {
    pub fn db_name(&self) -> &str {
        self.database.as_deref().unwrap_or("")
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

/// Test database connection AND list databases in a single connection
pub async fn test_and_list(config: &DbConfig) -> Result<(String, Vec<String>), String> {
    match config.db_type.as_str() {
        "mysql" => mysql::test_and_list(config).await,
        "postgres" => postgres::test_and_list(config).await,
        "sqlserver" => sqlserver::test_and_list(config).await,
        "oracle" => oracle::test_and_list(config).await,
        other => Err(format!("不支持的数据库类型: {}", other)),
    }
}

/// Fetch list of databases
pub async fn fetch_databases(config: &DbConfig) -> Result<Vec<String>, String> {
    match config.db_type.as_str() {
        "mysql" => mysql::fetch_databases(config).await,
        "postgres" => postgres::fetch_databases(config).await,
        "sqlserver" => sqlserver::fetch_databases(config).await,
        "oracle" => oracle::fetch_databases(config).await,
        other => Err(format!("不支持的数据库类型: {}", other)),
    }
}

/// Fetch complete database schema
pub async fn fetch_schema(config: &DbConfig) -> Result<DbSchema, String> {
    if config.db_name().is_empty() {
        return Err("请先选择一个数据库".to_string());
    }
    match config.db_type.as_str() {
        "mysql" => mysql::fetch_schema(config).await,
        "postgres" => postgres::fetch_schema(config).await,
        "sqlserver" => sqlserver::fetch_schema(config).await,
        "oracle" => oracle::fetch_schema(config).await,
        other => Err(format!("不支持的数据库类型: {}", other)),
    }
}
