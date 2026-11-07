pub mod commands;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_keyring::init())
        .manage(commands::AppState::new())
        .setup(|app| {
            // Setup macOS Menu Bar Tray Item (CodexBar style)
            let show_item = MenuItem::with_id(app, "show", "Open Kuota Dashboard", true, None::<&str>)?;
            let refresh_item = MenuItem::with_id(app, "refresh", "Refresh Telemetry", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Kuota", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &refresh_item, &separator, &quit_item])?;

            let default_icon = app.default_window_icon().cloned();

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Kuota · AI Quota & Balances")
                .title("Kuota")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "refresh" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval("window.__KUOTA_REFRESH && window.__KUOTA_REFRESH()");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = default_icon {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder.build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::UnderWindowBackground,
                        None,
                        None,
                    );
                }

                // Keep app running in menu bar when window close button is clicked
                let win_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });

                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_quota_status,
            commands::refresh_quota,
            commands::get_app_info,
            commands::open_external_url,
            commands::update_tray_title,
            commands::get_user_config,
            commands::save_user_config,
            commands::get_keychain_password,
            commands::set_keychain_password,
            commands::delete_keychain_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kuota desktop application");
}
