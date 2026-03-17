use ssh2::Session;
use std::io::Read;
use std::net::TcpStream;
use std::time::Duration;

/// 执行单条 SSH 命令并返回 stdout
fn ssh_exec(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    command: &str,
) -> Result<String, String> {
    let addr = format!("{}:{}", host, port);
    let tcp = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("地址解析失败: {}", e))?,
        Duration::from_secs(10),
    )
    .map_err(|e| format!("TCP 连接失败: {}", e))?;

    tcp.set_read_timeout(Some(Duration::from_secs(30))).ok();

    let mut sess = Session::new().map_err(|e| format!("创建 SSH 会话失败: {}", e))?;
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("SSH 握手失败: {}", e))?;
    sess.userauth_password(username, password)
        .map_err(|e| format!("SSH 认证失败: {}", e))?;

    if !sess.authenticated() {
        return Err("SSH 认证失败：用户名或密码错误".into());
    }

    let mut channel = sess
        .channel_session()
        .map_err(|e| format!("创建通道失败: {}", e))?;
    channel
        .exec(command)
        .map_err(|e| format!("执行命令失败: {}", e))?;

    let mut output = String::new();
    channel
        .read_to_string(&mut output)
        .map_err(|e| format!("读取输出失败: {}", e))?;
    channel.wait_close().ok();

    Ok(output)
}

/// 安全执行命令，失败时返回空字符串
fn ssh_exec_safe(
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    command: &str,
) -> String {
    ssh_exec(host, port, username, password, command).unwrap_or_default()
}

// ==================== Tauri Commands ====================

#[tauri::command]
pub async fn ssh_test_connection(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<String, String> {
    // 在 blocking 线程中执行 SSH 操作
    tokio::task::spawn_blocking(move || {
        ssh_exec(&host, port, &username, &password, "echo OK")
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
pub async fn ssh_exec_command(
    host: String,
    port: u16,
    username: String,
    password: String,
    command: String,
) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        ssh_exec(&host, port, &username, &password, &command)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
pub async fn ssh_read_server_info(
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        // 先测试连接
        ssh_exec(&host, port, &username, &password, "echo OK")?;

        let h = host.as_str();
        let u = username.as_str();
        let p = password.as_str();

        // 收集各项信息
        let os_info = ssh_exec_safe(h, port, u, p, "cat /etc/os-release 2>/dev/null || cat /etc/redhat-release 2>/dev/null || uname -a");
        let hostname = ssh_exec_safe(h, port, u, p, "hostname").trim().to_string();
        let cpu_info = ssh_exec_safe(h, port, u, p, "nproc 2>/dev/null && cat /proc/cpuinfo 2>/dev/null | grep 'model name' | head -1");
        let memory_info = ssh_exec_safe(h, port, u, p, "free -h 2>/dev/null || free -m");
        let disk_info = ssh_exec_safe(h, port, u, p, "df -h 2>/dev/null");
        let uptime = ssh_exec_safe(h, port, u, p, "uptime").trim().to_string();

        // 运行中的 systemd 服务
        let systemd_services = ssh_exec_safe(
            h, port, u, p,
            "systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | head -50",
        );

        // Docker 容器
        let docker_containers = ssh_exec_safe(
            h, port, u, p,
            "docker ps --format '{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null",
        );

        // 监听端口
        let listening_ports = ssh_exec_safe(
            h, port, u, p,
            "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null",
        );

        // 软件版本
        let nginx_version = ssh_exec_safe(h, port, u, p, "nginx -v 2>&1 || echo 'not installed'").trim().to_string();
        let java_version = ssh_exec_safe(h, port, u, p, "java -version 2>&1 | head -1 || echo 'not installed'").trim().to_string();
        let mysql_version = ssh_exec_safe(h, port, u, p, "mysql --version 2>/dev/null || mysqld --version 2>/dev/null || echo 'not installed'").trim().to_string();
        let redis_version = ssh_exec_safe(h, port, u, p, "redis-server --version 2>/dev/null || echo 'not installed'").trim().to_string();
        let node_version = ssh_exec_safe(h, port, u, p, "node -v 2>/dev/null || echo 'not installed'").trim().to_string();
        let python_version = ssh_exec_safe(h, port, u, p, "python3 --version 2>/dev/null || python --version 2>/dev/null || echo 'not installed'").trim().to_string();
        let docker_version = ssh_exec_safe(h, port, u, p, "docker --version 2>/dev/null || echo 'not installed'").trim().to_string();

        // Nginx 配置
        let nginx_config = ssh_exec_safe(h, port, u, p, "nginx -T 2>/dev/null | head -200");

        // 目录结构（常见部署路径）
        let dir_structure = ssh_exec_safe(
            h, port, u, p,
            "for d in /data /opt /srv /home /var/www; do [ -d \"$d\" ] && echo \"=== $d ===\" && ls -la $d 2>/dev/null | head -20; done",
        );

        Ok(serde_json::json!({
            "hostname": hostname,
            "host": host,
            "port": port,
            "osInfo": os_info,
            "cpuInfo": cpu_info,
            "memoryInfo": memory_info,
            "diskInfo": disk_info,
            "uptime": uptime,
            "systemdServices": systemd_services,
            "dockerContainers": docker_containers,
            "listeningPorts": listening_ports,
            "softwareVersions": {
                "nginx": nginx_version,
                "java": java_version,
                "mysql": mysql_version,
                "redis": redis_version,
                "node": node_version,
                "python": python_version,
                "docker": docker_version,
            },
            "nginxConfig": nginx_config,
            "dirStructure": dir_structure,
        }))
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}
