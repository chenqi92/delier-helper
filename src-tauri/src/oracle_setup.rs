//! Oracle Instant Client 运行时管理
//!
//! Oracle crate 通过 ODPI-C 在首次连接时 dlopen 加载 OCI 动态库。
//! 这个模块负责：
//! 1. 应用启动时把 <app_data>/oracle_client/ 加入动态库搜索路径
//!    （Windows PATH / Linux LD_LIBRARY_PATH / macOS DYLD_LIBRARY_PATH）
//! 2. 检测是否已安装
//! 3. 按平台下载并解压 Instant Client Basic Light

use std::env;
use std::io::Cursor;
use std::path::{Path, PathBuf};

pub const SUBDIR: &str = "oracle_client";

pub fn install_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(SUBDIR)
}

pub fn is_installed(dir: &Path) -> bool {
    if !dir.exists() {
        return false;
    }
    #[cfg(target_os = "windows")]
    {
        return dir.join("oci.dll").exists();
    }
    #[cfg(target_os = "macos")]
    {
        return dir.join("libclntsh.dylib").exists();
    }
    #[cfg(target_os = "linux")]
    {
        return dir.join("libclntsh.so").exists();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        return false;
    }
}

/// 把 install_dir 注入到当前进程的动态库搜索路径
/// 必须在 oracle crate 触发 dlopen 之前调用（启动时调用最佳）
pub fn configure_loading_path(dir: &Path) {
    if !is_installed(dir) {
        return;
    }
    let dir_str = dir.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let cur = env::var("PATH").unwrap_or_default();
        let new = if cur.is_empty() {
            dir_str.clone()
        } else {
            format!("{};{}", dir_str, cur)
        };
        unsafe {
            env::set_var("PATH", new);
        }
    }
    #[cfg(target_os = "linux")]
    {
        let cur = env::var("LD_LIBRARY_PATH").unwrap_or_default();
        let new = if cur.is_empty() {
            dir_str.clone()
        } else {
            format!("{}:{}", dir_str, cur)
        };
        unsafe {
            env::set_var("LD_LIBRARY_PATH", new);
        }
    }
    #[cfg(target_os = "macos")]
    {
        let cur = env::var("DYLD_LIBRARY_PATH").unwrap_or_default();
        let new = if cur.is_empty() {
            dir_str.clone()
        } else {
            format!("{}:{}", dir_str, cur)
        };
        unsafe {
            env::set_var("DYLD_LIBRARY_PATH", new);
        }
    }
}

pub fn download_url() -> Option<&'static str> {
    #[cfg(target_os = "windows")]
    {
        Some("https://download.oracle.com/otn_software/nt/instantclient/instantclient-basiclite-windows.x64.zip")
    }
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        Some("https://download.oracle.com/otn_software/mac/instantclient/instantclient-basiclite-macos.x64.zip")
    }
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        Some("https://download.oracle.com/otn_software/mac/instantclient/instantclient-basiclite-macos.arm64.zip")
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        Some("https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip")
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        Some("https://download.oracle.com/otn_software/linux/instantclient-aarch64/instantclient-basiclite-linux.arm64.zip")
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

pub fn platform_label() -> &'static str {
    #[cfg(target_os = "windows")]
    return "Windows x64";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "macOS Intel";
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "macOS Apple Silicon";
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "Linux x86_64";
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "Linux aarch64";
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown";
}

pub async fn install(target_dir: &Path) -> Result<(), String> {
    let url = download_url().ok_or_else(|| {
        format!(
            "当前平台 {} 暂不支持自动下载 Oracle Instant Client",
            platform_label()
        )
    })?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("HTTP 客户端初始化失败: {}", e))?;

    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("下载 HTTP 错误: {}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("读取下载内容失败: {}", e))?;

    std::fs::create_dir_all(target_dir).map_err(|e| format!("创建目录失败: {}", e))?;

    extract_zip_flat(bytes.to_vec(), target_dir)
        .map_err(|e| format!("解压失败: {}", e))?;

    configure_loading_path(target_dir);
    Ok(())
}

/// 解压 ZIP，去掉顶层目录（Oracle ZIP 第一层是 instantclient_XX_Y/）
fn extract_zip_flat(zip_bytes: Vec<u8>, target_dir: &Path) -> Result<(), String> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_path = match entry.enclosed_name() {
            Some(p) => p.to_path_buf(),
            None => continue,
        };
        let mut comps = entry_path.components();
        comps.next(); // strip leading "instantclient_XX_Y" dir
        let rel: PathBuf = comps.collect();
        if rel.as_os_str().is_empty() {
            continue;
        }
        let out_path = target_dir.join(&rel);

        if entry.is_dir() {
            let _ = std::fs::create_dir_all(&out_path);
        } else {
            if let Some(p) = out_path.parent() {
                let _ = std::fs::create_dir_all(p);
            }
            let mut out = std::fs::File::create(&out_path)
                .map_err(|e| format!("写文件 {} 失败: {}", out_path.display(), e))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Some(mode) = entry.unix_mode() {
                    let _ = std::fs::set_permissions(
                        &out_path,
                        std::fs::Permissions::from_mode(mode),
                    );
                }
            }
        }
    }
    Ok(())
}
