use crate::scanner;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub success: bool,
    pub files: Vec<scanner::FileInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DetectResult {
    pub success: bool,
    pub types: Vec<scanner::FileTypeInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReadRequest {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub ext: String,
}

#[derive(Debug, Serialize)]
pub struct FileContent {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub ext: String,
    pub content: String,
    pub line_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReadResult {
    pub success: bool,
    pub files: Vec<FileContent>,
    pub error: Option<String>,
}

/// 扫描目录
#[tauri::command]
pub fn scan_directory(
    dir_path: String,
    custom_ignore: Vec<String>,
    use_gitignore: bool,
) -> ScanResult {
    let files = scanner::scan_dir(&dir_path, &custom_ignore, use_gitignore);
    ScanResult {
        success: true,
        files,
        error: None,
    }
}

/// 检测文件类型
#[tauri::command]
pub fn detect_file_types(
    dir_paths: Vec<String>,
    custom_ignore: Vec<String>,
    use_gitignore: bool,
) -> DetectResult {
    let types = scanner::detect_types(&dir_paths, &custom_ignore, use_gitignore);
    DetectResult {
        success: true,
        types,
        error: None,
    }
}

/// 批量读取文件内容
#[tauri::command]
pub fn read_files_content(files: Vec<ReadRequest>) -> ReadResult {
    let mut results = Vec::new();

    for file in files {
        match scanner::read_file_content(&file.path) {
            Ok(content) => {
                let line_count = content.lines().count();
                results.push(FileContent {
                    path: file.path,
                    relative_path: file.relative_path,
                    name: file.name,
                    ext: file.ext,
                    content,
                    line_count,
                    error: None,
                });
            }
            Err(e) => {
                results.push(FileContent {
                    path: file.path,
                    relative_path: file.relative_path,
                    name: file.name,
                    ext: file.ext,
                    content: String::new(),
                    line_count: 0,
                    error: Some(e),
                });
            }
        }
    }

    ReadResult {
        success: true,
        files: results,
        error: None,
    }
}

// ==================== 数据库命令 ====================

use crate::db_connector;

#[derive(Debug, Serialize)]
pub struct DbTestResult {
    pub success: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DbSchemaResult {
    pub success: bool,
    pub schema: Option<db_connector::DbSchema>,
    pub error: Option<String>,
}

/// 测试数据库连接
#[tauri::command]
pub async fn db_test_connection(config: db_connector::DbConfig) -> DbTestResult {
    match db_connector::test_connection(&config).await {
        Ok(version) => DbTestResult {
            success: true,
            version: Some(version),
            error: None,
        },
        Err(e) => DbTestResult {
            success: false,
            version: None,
            error: Some(e),
        },
    }
}

/// 获取数据库结构
#[tauri::command]
pub async fn db_fetch_schema(config: db_connector::DbConfig) -> DbSchemaResult {
    match db_connector::fetch_schema(&config).await {
        Ok(schema) => DbSchemaResult {
            success: true,
            schema: Some(schema),
            error: None,
        },
        Err(e) => DbSchemaResult {
            success: false,
            schema: None,
            error: Some(e),
        },
    }
}

#[derive(Debug, Serialize)]
pub struct DbListResult {
    pub success: bool,
    pub databases: Vec<String>,
    pub error: Option<String>,
}

/// 获取数据库列表
#[tauri::command]
pub async fn db_fetch_databases(config: db_connector::DbConfig) -> DbListResult {
    match db_connector::fetch_databases(&config).await {
        Ok(databases) => DbListResult {
            success: true,
            databases,
            error: None,
        },
        Err(e) => DbListResult {
            success: false,
            databases: vec![],
            error: Some(e),
        },
    }
}
