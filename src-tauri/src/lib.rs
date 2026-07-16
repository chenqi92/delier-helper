mod api_doc_store;
mod commands;
mod db_connector;
mod oracle_setup;
mod scanner;
mod ssh_connector;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:app.db", vec![])
                .build(),
        )
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            api_doc_store::api_doc_create_job,
            api_doc_store::api_doc_append_modules,
            api_doc_store::api_doc_finish_job,
            api_doc_store::api_doc_get_job,
            api_doc_store::api_doc_list_modules,
            api_doc_store::api_doc_query_apis,
            api_doc_store::api_doc_update_apis,
            api_doc_store::api_doc_delete_job,
            commands::scan_directory,
            commands::detect_file_types,
            commands::read_files_content,
            commands::db_test_connection,
            commands::db_fetch_schema,
            commands::db_fetch_databases,
            commands::llm_request,
            commands::llm_cancel_request,
            commands::llm_get_request,
            commands::oracle_client_status,
            commands::oracle_client_install,
            ssh_connector::ssh_test_connection,
            ssh_connector::ssh_read_server_info,
        ])
        .setup(|app| {
            let api_doc_data_dir = app.path().app_data_dir()?;
            app.manage(api_doc_store::ApiDocStore::new(api_doc_data_dir));

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // 启动时尝试把已下载的 Oracle Instant Client 加入动态库搜索路径
            if let Ok(data_dir) = app.path().app_data_dir() {
                let dir = oracle_setup::install_dir(&data_dir);
                oracle_setup::configure_loading_path(&dir);
            }

            if let Some(window) = app.get_webview_window("main") {
                let icon_bytes = include_bytes!("../icons/icon.png");
                if let Ok(img) = image::load_from_memory(icon_bytes) {
                    let rgba = img.to_rgba8();
                    let (w, h) = rgba.dimensions();
                    let icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
                    let _ = window.set_icon(icon);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
