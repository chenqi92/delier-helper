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

// ==================== LLM HTTP 请求 ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    pub url: String,
    pub api_key: String,
    pub body: String,
    pub is_gemini: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub success: bool,
    pub status: u16,
    pub body: String,
    pub error: Option<String>,
}

/// 通过 Rust 后端直接发起 LLM API 请求（绕过前端 fetch 的 header 限制）
#[tauri::command]
pub async fn llm_request(req: LlmRequest) -> LlmResponse {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return LlmResponse {
                success: false,
                status: 0,
                body: String::new(),
                error: Some(format!("创建 HTTP 客户端失败: {}", e)),
            }
        }
    };

    // 构建请求 URL：Gemini 用 ?key= 查询参数
    let url = if req.is_gemini {
        if req.url.contains('?') {
            format!("{}&key={}", req.url, req.api_key)
        } else {
            format!("{}?key={}", req.url, req.api_key)
        }
    } else {
        req.url.clone()
    };

    let mut builder = client.post(&url).header("Content-Type", "application/json");

    // apiKey 非空时才发送认证头（本地部署如 Ollama/vLLM 不需要）
    if !req.api_key.is_empty() {
        builder = builder.header("Authorization", format!("Bearer {}", req.api_key));
    }

    // Gemini 额外带 x-goog-api-key（Google API 另一种标准认证方式）
    if req.is_gemini {
        builder = builder.header("x-goog-api-key", req.api_key.clone());
    }

    let resp = match builder.body(req.body).send().await {
        Ok(r) => r,
        Err(e) => {
            return LlmResponse {
                success: false,
                status: 0,
                body: String::new(),
                error: Some(format!("请求失败: {}", e)),
            }
        }
    };

    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    let success = status >= 200 && status < 300;
    let error = if success {
        None
    } else {
        Some(format!("HTTP {}: {}", status, body))
    };

    LlmResponse {
        success,
        status,
        body,
        error,
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmGetRequest {
    pub url: String,
    pub api_key: String,
}

/// HTTP GET 请求（用于获取模型列表等）
#[tauri::command]
pub async fn llm_get_request(req: LlmGetRequest) -> LlmResponse {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return LlmResponse {
                success: false,
                status: 0,
                body: String::new(),
                error: Some(format!("创建 HTTP 客户端失败: {}", e)),
            }
        }
    };

    let mut builder = client.get(&req.url);
    if !req.api_key.is_empty() {
        builder = builder.header("Authorization", format!("Bearer {}", req.api_key));
    }

    let resp = match builder.send().await {
        Ok(r) => r,
        Err(e) => {
            return LlmResponse {
                success: false,
                status: 0,
                body: String::new(),
                error: Some(format!("请求失败: {}", e)),
            }
        }
    };

    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();
    let success = status >= 200 && status < 300;
    let error = if success {
        None
    } else {
        Some(format!("HTTP {}: {}", status, body))
    };

    LlmResponse {
        success,
        status,
        body,
        error,
    }
}
