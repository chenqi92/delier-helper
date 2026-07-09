use crate::scanner;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tokio::sync::watch;

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
    pub databases: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DbSchemaResult {
    pub success: bool,
    pub schema: Option<db_connector::DbSchema>,
    pub error: Option<String>,
}

/// 测试数据库连接（同时获取数据库列表，一次连接）
#[tauri::command]
pub async fn db_test_connection(config: db_connector::DbConfig) -> DbTestResult {
    match db_connector::test_and_list(&config).await {
        Ok((version, databases)) => DbTestResult {
            success: true,
            version: Some(version),
            databases,
            error: None,
        },
        Err(e) => DbTestResult {
            success: false,
            version: None,
            databases: vec![],
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
    pub is_anthropic: Option<bool>,
    pub anthropic_beta: Option<String>,
    pub client_id: Option<String>,
    pub request_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmResponse {
    pub success: bool,
    pub status: u16,
    pub body: String,
    pub error: Option<String>,
}

type LlmCancelMap = Mutex<HashMap<String, watch::Sender<bool>>>;
static LLM_CANCEL_MAP: OnceLock<LlmCancelMap> = OnceLock::new();

fn llm_cancel_map() -> &'static LlmCancelMap {
    LLM_CANCEL_MAP.get_or_init(|| Mutex::new(HashMap::new()))
}

fn register_llm_cancel(request_id: Option<&str>) -> Option<(String, watch::Receiver<bool>)> {
    let request_id = request_id?.trim();
    if request_id.is_empty() {
        return None;
    }
    let (tx, rx) = watch::channel(false);
    if let Ok(mut pending) = llm_cancel_map().lock() {
        pending.insert(request_id.to_string(), tx);
        Some((request_id.to_string(), rx))
    } else {
        None
    }
}

fn unregister_llm_cancel(request_id: &str) {
    if let Ok(mut pending) = llm_cancel_map().lock() {
        pending.remove(request_id);
    }
}

async fn wait_llm_cancelled(rx: &mut watch::Receiver<bool>) {
    if *rx.borrow() {
        return;
    }
    while rx.changed().await.is_ok() {
        if *rx.borrow() {
            return;
        }
    }
}

#[tauri::command]
pub fn llm_cancel_request(request_id: String) -> bool {
    let request_id = request_id.trim();
    if request_id.is_empty() {
        return false;
    }
    let sender = llm_cancel_map()
        .lock()
        .ok()
        .and_then(|mut pending| pending.remove(request_id));
    if let Some(sender) = sender {
        let _ = sender.send(true);
        true
    } else {
        false
    }
}

/// 通过 Rust 后端直接发起 LLM API 请求（绕过前端 fetch 的 header 限制）
#[tauri::command]
pub async fn llm_request(req: LlmRequest) -> LlmResponse {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
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

    let is_anthropic = req.is_anthropic.unwrap_or(false);

    let mut builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json");

    // apiKey 非空时才发送认证头（本地部署如 Ollama/vLLM 不需要）
    if !req.api_key.is_empty() {
        if is_anthropic {
            builder = builder
                .header("x-api-key", req.api_key.clone())
                .header("anthropic-version", "2023-06-01");
        } else {
            builder = builder.header("Authorization", format!("Bearer {}", req.api_key));
        }
    }

    // Gemini 额外带 x-goog-api-key（Google API 另一种标准认证方式）
    if req.is_gemini {
        builder = builder.header("x-goog-api-key", req.api_key.clone());
    }
    if is_anthropic {
        if let Some(anthropic_beta) = req.anthropic_beta.as_ref() {
            if !anthropic_beta.is_empty() {
                builder = builder.header("anthropic-beta", anthropic_beta);
            }
        }
    }
    if let Some(client_id) = req.client_id.as_ref() {
        if !client_id.is_empty() {
            builder = builder.header("X-Client-Id", client_id);
        }
    }

    let mut cancel_registration = register_llm_cancel(req.request_id.as_deref());
    let resp_result = if let Some((request_id, cancel_rx)) = cancel_registration.as_mut() {
        let send_future = builder.body(req.body).send();
        tokio::select! {
            _ = wait_llm_cancelled(cancel_rx) => {
                unregister_llm_cancel(request_id.as_str());
                return LlmResponse {
                    success: false,
                    status: 499,
                    body: String::new(),
                    error: Some("请求已取消".to_string()),
                };
            }
            result = send_future => result,
        }
    } else {
        builder.body(req.body).send().await
    };

    let resp = match resp_result {
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
    let text_result = if let Some((request_id, cancel_rx)) = cancel_registration.as_mut() {
        let text_future = resp.text();
        tokio::select! {
            _ = wait_llm_cancelled(cancel_rx) => {
                unregister_llm_cancel(request_id.as_str());
                return LlmResponse {
                    success: false,
                    status: 499,
                    body: String::new(),
                    error: Some("请求已取消".to_string()),
                };
            }
            result = text_future => result,
        }
    } else {
        resp.text().await
    };
    if let Some((request_id, _)) = cancel_registration.as_ref() {
        unregister_llm_cancel(request_id.as_str());
    }
    let body = text_result.unwrap_or_default();
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
    pub is_anthropic: Option<bool>,
    pub anthropic_beta: Option<String>,
    pub client_id: Option<String>,
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

    let is_anthropic = req.is_anthropic.unwrap_or(false);
    let mut builder = client.get(&req.url).header("Accept", "application/json");
    if !req.api_key.is_empty() {
        if is_anthropic {
            builder = builder
                .header("x-api-key", req.api_key.clone())
                .header("anthropic-version", "2023-06-01");
        } else {
            builder = builder.header("Authorization", format!("Bearer {}", req.api_key));
        }
    }
    if is_anthropic {
        if let Some(anthropic_beta) = req.anthropic_beta.as_ref() {
            if !anthropic_beta.is_empty() {
                builder = builder.header("anthropic-beta", anthropic_beta);
            }
        }
    }
    if let Some(client_id) = req.client_id.as_ref() {
        if !client_id.is_empty() {
            builder = builder.header("X-Client-Id", client_id);
        }
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

// ==================== Oracle Instant Client 管理 ====================

use crate::oracle_setup;
use tauri::Manager;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleClientStatus {
    pub installed: bool,
    pub install_dir: String,
    pub platform: String,
    pub download_url: Option<String>,
    pub supported: bool,
}

#[tauri::command]
pub async fn oracle_client_status(app: tauri::AppHandle) -> Result<OracleClientStatus, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;
    let dir = oracle_setup::install_dir(&data_dir);
    let url = oracle_setup::download_url();
    Ok(OracleClientStatus {
        installed: oracle_setup::is_installed(&dir),
        install_dir: dir.to_string_lossy().to_string(),
        platform: oracle_setup::platform_label().to_string(),
        download_url: url.map(|s| s.to_string()),
        supported: url.is_some(),
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OracleClientInstallResult {
    pub success: bool,
    pub install_dir: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn oracle_client_install(app: tauri::AppHandle) -> OracleClientInstallResult {
    let data_dir = match app.path().app_data_dir() {
        Ok(d) => d,
        Err(e) => {
            return OracleClientInstallResult {
                success: false,
                install_dir: String::new(),
                error: Some(format!("获取应用数据目录失败: {}", e)),
            };
        }
    };
    let dir = oracle_setup::install_dir(&data_dir);
    match oracle_setup::install(&dir).await {
        Ok(()) => OracleClientInstallResult {
            success: true,
            install_dir: dir.to_string_lossy().to_string(),
            error: None,
        },
        Err(e) => OracleClientInstallResult {
            success: false,
            install_dir: dir.to_string_lossy().to_string(),
            error: Some(e),
        },
    }
}
