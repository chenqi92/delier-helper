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

// 注意：不暴露通用的 ssh_exec_command 命令到前端
// 仅提供 ssh_test_connection（只执行 echo OK）和 ssh_read_server_info（只执行只读命令）
// 确保不会对服务器产生任何写操作或副作用

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

        // 网络接口（区分内网/外网 IP）
        let network_interfaces = ssh_exec_safe(h, port, u, p, "ip addr show 2>/dev/null || ifconfig 2>/dev/null");

        // LVM 磁盘布局（扩容说明用）
        let lvm_info = ssh_exec_safe(h, port, u, p, "echo '=== LV ===' && lvs --noheadings 2>/dev/null; echo '=== VG ===' && vgs --noheadings 2>/dev/null; echo '=== PV ===' && pvs --noheadings 2>/dev/null");

        // 运行中的 systemd 服务
        let systemd_services = ssh_exec_safe(
            h, port, u, p,
            "systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | head -50",
        );

        // systemd 自定义服务配置详情（获取 ExecStart、WorkingDirectory 等）
        // 只读取非系统级的自定义服务，通过检查 /etc/systemd/system/ 下的 .service 文件
        let systemd_service_configs = ssh_exec_safe(
            h, port, u, p,
            "for f in /etc/systemd/system/*.service; do [ -f \"$f\" ] && echo \"=== $(basename $f) ===\" && cat \"$f\" 2>/dev/null; done | head -300",
        );

        // Docker 容器
        let docker_containers = ssh_exec_safe(
            h, port, u, p,
            "docker ps --format '{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null",
        );

        // docker-compose 配置（如果存在）
        let docker_compose_configs = ssh_exec_safe(
            h, port, u, p,
            "for d in /data /opt /srv /home; do find \"$d\" -maxdepth 3 -name 'docker-compose.yml' -o -name 'docker-compose.yaml' 2>/dev/null; done | head -10",
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

        // 已安装软件的实际路径（用于确定安装目录）
        let software_paths = ssh_exec_safe(
            h, port, u, p,
            "for cmd in nginx java mysql mysqld redis-server redis-cli node python3 docker emqx nacos minio; do p=$(which $cmd 2>/dev/null); [ -n \"$p\" ] && echo \"$cmd: $p\"; done",
        );

        // 查找 JAR/WAR 文件（定位微服务部署路径）
        let app_files = ssh_exec_safe(
            h, port, u, p,
            "find /data /opt /srv /home -maxdepth 4 \\( -name '*.jar' -o -name '*.war' \\) -type f 2>/dev/null | head -30",
        );

        // 查找 deploy/启动脚本
        let deploy_scripts = ssh_exec_safe(
            h, port, u, p,
            "find /data /opt /srv /home -maxdepth 4 \\( -name 'deploy*.sh' -o -name 'start*.sh' -o -name 'stop*.sh' -o -name 'restart*.sh' -o -name '*.service' \\) -type f 2>/dev/null | head -20",
        );

        // 关键进程运行参数（识别 Java 服务的启动参数、端口等）
        let java_processes = ssh_exec_safe(
            h, port, u, p,
            "ps aux 2>/dev/null | grep -E 'java|node|python|nginx|redis|mysql|docker|minio|nacos|emqx' | grep -v grep | head -30",
        );

        // Nginx 配置
        let nginx_config = ssh_exec_safe(h, port, u, p, "nginx -T 2>/dev/null | head -300");

        // 定时任务
        let crontab_info = ssh_exec_safe(h, port, u, p, "crontab -l 2>/dev/null; echo '=== /etc/crontab ===' && cat /etc/crontab 2>/dev/null | grep -v '^#' | grep -v '^$'");

        // 防火墙规则
        let firewall_rules = ssh_exec_safe(
            h, port, u, p,
            "firewall-cmd --list-all 2>/dev/null || iptables -L -n 2>/dev/null | head -40 || echo 'no firewall detected'",
        );

        // 目录结构（常见部署路径，含子目录深度扫描）
        let dir_structure = ssh_exec_safe(
            h, port, u, p,
            "for d in /data /opt /srv /home /var/www /usr/local; do [ -d \"$d\" ] && echo \"=== $d ===\" && find \"$d\" -maxdepth 2 -type d 2>/dev/null | head -30; done",
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
            "networkInterfaces": network_interfaces,
            "lvmInfo": lvm_info,
            "systemdServices": systemd_services,
            "systemdServiceConfigs": systemd_service_configs,
            "dockerContainers": docker_containers,
            "dockerComposeConfigs": docker_compose_configs,
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
            "softwarePaths": software_paths,
            "appFiles": app_files,
            "deployScripts": deploy_scripts,
            "javaProcesses": java_processes,
            "nginxConfig": nginx_config,
            "crontabInfo": crontab_info,
            "firewallRules": firewall_rules,
            "dirStructure": dir_structure,
        }))
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}
