pub mod commands;

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
            // Setup macOS Menu Bar Tray Item
            let show_item = MenuItem::with_id(app, "show", "Open Kuota Dashboard", true, None::<&str>)?;
            let refresh_item = MenuItem::with_id(app, "refresh", "Refresh Telemetry", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Kuota", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &refresh_item, &separator, &quit_item])?;

            let default_icon = app.default_window_icon().cloned();

            let last_hide = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(10)));
            let last_hide_tray = Arc::clone(&last_hide);

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Kuota · AI Quota & Balances")
                .title("Kuota")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        let _ = commands::open_dashboard_window(app.clone());
                    }
                    "refresh" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.eval("window.__KUOTA_REFRESH && window.__KUOTA_REFRESH()");
                        }
                        if let Some(window) = app.get_webview_window("tray") {
                            let _ = window.eval("window.__KUOTA_REFRESH && window.__KUOTA_REFRESH()");
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let now = Instant::now();
                        let last = *last_hide_tray.lock().unwrap();
                        let app = tray.app_handle();

                        if let Some(tray_win) = app.get_webview_window("tray") {
                            let is_vis = tray_win.is_visible().unwrap_or(false);
                            if is_vis {
                                *last_hide_tray.lock().unwrap() = now;
                                let _ = tray_win.hide();
                            } else if now.duration_since(last) > Duration::from_millis(250) {
                                let scale = tray_win.scale_factor().unwrap_or(1.0);
                                let pos = rect.position.to_logical::<f64>(scale);
                                let size = rect.size.to_logical::<f64>(scale);
                                let win_size = tray_win
                                    .outer_size()
                                    .unwrap_or(tauri::PhysicalSize::new(360, 580))
                                    .to_logical::<f64>(scale);

                                let mut target_x = pos.x + (size.width / 2.0) - (win_size.width / 2.0);
                                let target_y = pos.y + size.height + 4.0;

                                if let Ok(Some(monitor)) = tray_win.current_monitor() {
                                    let mon_size = monitor.size().to_logical::<f64>(scale);
                                    let mon_pos = monitor.position().to_logical::<f64>(scale);
                                    let max_x = mon_pos.x + mon_size.width - win_size.width - 12.0;
                                    let min_x = mon_pos.x + 12.0;
                                    target_x = target_x.clamp(min_x, max_x);
                                }

                                let _ = tray_win.set_position(tauri::Position::Logical(
                                    tauri::LogicalPosition::new(target_x, target_y),
                                ));
                                let _ = tray_win.show();
                                let _ = tray_win.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = default_icon {
                tray_builder = tray_builder.icon(icon);
            }

            let tray = tray_builder.build(app)?;

            // Apply user config for menu bar visibility
            let user_cfg = commands::get_user_config();
            if let Some(show_tray) = user_cfg.get("showMenuBarIcon").and_then(|v| v.as_bool()) {
                if !show_tray {
                    let _ = tray.set_visible(false);
                }
            }

            // Setup tray popover window
            if let Some(tray_win) = app.get_webview_window("tray") {
                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                    let _ = apply_vibrancy(
                        &tray_win,
                        NSVisualEffectMaterial::HudWindow,
                        None,
                        None,
                    );
                }

                let last_hide_win = Arc::clone(&last_hide);
                let tray_win_clone = tray_win.clone();
                tray_win.on_window_event(move |event| match event {
                    tauri::WindowEvent::Focused(false) => {
                        *last_hide_win.lock().unwrap() = Instant::now();
                        let _ = tray_win_clone.hide();
                    }
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        *last_hide_win.lock().unwrap() = Instant::now();
                        let _ = tray_win_clone.hide();
                    }
                    _ => {}
                });
            }

            // Setup main dashboard window
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

                let win_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });

                let _ = window.show();
                let _ = window.set_focus();
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
            commands::open_dashboard_window,
            commands::set_menu_bar_visible,
            commands::exit_app,
            commands::send_desktop_notification,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Kuota desktop application")
        .run(|app, event| match event {
            tauri::RunEvent::Reopen { .. } => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            _ => {}
        });
}
