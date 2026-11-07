use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde_json::Value;
use tauri::{Manager, State};

pub struct AppState {
    pub cached_status: Mutex<Option<(Instant, Value)>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            cached_status: Mutex::new(None),
        }
    }
}

const CACHE_TTL: Duration = Duration::from_secs(15);

fn get_augmented_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let current_path = std::env::var("PATH").unwrap_or_default();
    format!("{}/.bun/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:{}/.cargo/bin:{}/.local/bin:{}", home, home, home, current_path)
}

fn find_repo_root() -> Option<PathBuf> {
    // 1. Try current working directory
    if let Ok(current) = std::env::current_dir() {
        let mut cur = current;
        for _ in 0..6 {
            if cur.join("packages").join("cli").exists() {
                return Some(cur);
            }
            if let Some(parent) = cur.parent() {
                cur = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // 2. Try current executable parent tree (e.g. apps/desktop/src-tauri/target/release/...)
    if let Ok(exe_path) = std::env::current_exe() {
        let mut cur = exe_path;
        for _ in 0..10 {
            if cur.join("packages").join("cli").exists() {
                return Some(cur);
            }
            if let Some(parent) = cur.parent() {
                cur = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // 3. Try standard developer repository path
    if let Ok(home) = std::env::var("HOME") {
        let dev_path = PathBuf::from(&home).join("Dev").join("kuota");
        if dev_path.join("packages").join("cli").exists() {
            return Some(dev_path);
        }
    }

    None
}

fn find_binary(name: &str) -> Option<PathBuf> {
    let augmented = get_augmented_path();
    for path in std::env::split_paths(&augmented) {
        let candidate = path.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn inject_keyring_env(cmd: &mut Command) {
    const PROVIDERS: &[(&str, &str)] = &[
        ("moonshot", "MOONSHOT_API_KEY"),
        ("deepseek", "DEEPSEEK_API_KEY"),
        ("openrouter", "OPENROUTER_API_KEY"),
        ("glm", "ZHIPU_API_KEY"),
        ("mimo", "MIMO_API_KEY"),
        ("opencodego", "OPENCODE_ZEN_API_KEY"),
        ("claude", "ANTHROPIC_API_KEY"),
        ("codex", "OPENAI_API_KEY"),
        ("gemini", "GEMINI_API_KEY"),
        ("minimax", "MINIMAX_API_KEY"),
        ("grok", "GROK_API_KEY"),
        ("openai", "OPENAI_API_KEY"),
    ];

    for (prov, env_var) in PROVIDERS {
        if let Ok(entry) = keyring::Entry::new("dev.huakun.kuota", &format!("api_key:{}", prov)) {
            if let Ok(sec) = entry.get_password() {
                if !sec.is_empty() {
                    cmd.env(env_var, sec);
                }
            }
        }
    }
}

pub fn execute_cli_subcommand(subcmd: &str, extra_args: &[&str]) -> Result<Value, String> {
    let augmented_path = get_augmented_path();
    let repo_root = find_repo_root();

    // Candidate 1: bun packages/cli/src/main.ts <subcmd> <args>
    if let Some(ref root) = repo_root {
        let bun_path = find_binary("bun").unwrap_or_else(|| PathBuf::from("bun"));
        let cli_script = root.join("packages").join("cli").join("src").join("main.ts");
        if cli_script.exists() {
            let mut cmd = Command::new(&bun_path);
            cmd.arg(&cli_script)
                .arg(subcmd)
                .args(extra_args)
                .env("PATH", &augmented_path)
                .current_dir(root);
            inject_keyring_env(&mut cmd);
            let output = cmd.output();

            if let Ok(out) = output {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        return Ok(v);
                    }
                }
            }
        }

        // Candidate 2: node packages/cli/dist/main.mjs <subcmd> <args>
        let node_path = find_binary("node").unwrap_or_else(|| PathBuf::from("node"));
        let dist_script = root.join("packages").join("cli").join("dist").join("main.mjs");
        if dist_script.exists() {
            let mut cmd = Command::new(&node_path);
            cmd.arg(&dist_script)
                .arg(subcmd)
                .args(extra_args)
                .env("PATH", &augmented_path)
                .current_dir(root);
            inject_keyring_env(&mut cmd);
            let output = cmd.output();

            if let Ok(out) = output {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        return Ok(v);
                    }
                }
            }
        }
    }

    // Candidate 3: global kuota command
    let kuota_path = find_binary("kuota").unwrap_or_else(|| PathBuf::from("kuota"));
    let mut cmd = Command::new(&kuota_path);
    cmd.arg(subcmd)
        .args(extra_args)
        .env("PATH", &augmented_path);
    inject_keyring_env(&mut cmd);
    let output = cmd.output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Ok(v) = serde_json::from_str::<Value>(&text) {
                return Ok(v);
            }
        }
    }

    // Fallback: Return empty schema envelope with error
    Ok(serde_json::json!({
        "schemaVersion": 1,
        "generatedAt": chrono::Utc::now().to_rfc3339(),
        "providers": [],
        "errors": [{"code": "NO_CLI_AVAILABLE"}]
    }))
}

fn execute_probe() -> Result<Value, String> {
    execute_cli_subcommand("status", &["--json"])
}

pub async fn get_quota_status_impl(
    fresh: Option<bool>,
    state: &AppState,
) -> Result<Value, String> {
    let force_fresh = fresh.unwrap_or(false);

    if !force_fresh {
        if let Ok(guard) = state.cached_status.lock() {
            if let Some((fetched_at, ref value)) = *guard {
                if fetched_at.elapsed() < CACHE_TTL {
                    return Ok(value.clone());
                }
            }
        }
    }

    // Run probe in background blocking thread so event loop is never blocked
    let result = tauri::async_runtime::spawn_blocking(execute_probe)
        .await
        .map_err(|e| e.to_string())??;

    if let Ok(mut guard) = state.cached_status.lock() {
        *guard = Some((Instant::now(), result.clone()));
    }

    Ok(result)
}

pub async fn refresh_quota_impl(state: &AppState) -> Result<Value, String> {
    get_quota_status_impl(Some(true), state).await
}

#[tauri::command]
pub async fn get_quota_status(
    fresh: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    get_quota_status_impl(fresh, &state).await
}

#[tauri::command]
pub async fn refresh_quota(state: State<'_, AppState>) -> Result<Value, String> {
    refresh_quota_impl(&state).await
}

#[tauri::command]
pub fn get_app_info() -> Value {
    serde_json::json!({
        "name": "Kuota",
        "version": "0.1.0",
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "mode": "desktop"
    })
}

fn get_config_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    Some(PathBuf::from(home).join(".kuota").join("config.json"))
}

#[tauri::command]
pub fn get_user_config() -> Value {
    if let Some(path) = get_config_path() {
        if let Ok(contents) = std::fs::read_to_string(path) {
            if let Ok(val) = serde_json::from_str::<Value>(&contents) {
                return val;
            }
        }
    }
    serde_json::json!({
        "version": 1,
        "keys": {},
        "visibility": {}
    })
}

#[tauri::command]
pub fn save_user_config(config: Value) -> Result<(), String> {
    if let Some(path) = get_config_path() {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let formatted = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        std::fs::write(path, formatted).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Cannot resolve HOME directory".into())
    }
}

#[tauri::command]
pub fn update_tray_title(app: tauri::AppHandle, title: Option<String>) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_title(title);
    }
    Ok(())
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn get_keychain_password(provider: String) -> Option<String> {
    let entry = keyring::Entry::new("dev.huakun.kuota", &format!("api_key:{}", provider)).ok()?;
    entry.get_password().ok()
}

#[tauri::command]
pub fn set_keychain_password(provider: String, secret: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("security")
            .arg("add-generic-password")
            .arg("-s")
            .arg("dev.huakun.kuota")
            .arg("-a")
            .arg(format!("api_key:{}", provider))
            .arg("-w")
            .arg(&secret)
            .arg("-A")
            .arg("-U")
            .status();

        if let Ok(s) = status {
            if s.success() {
                return Ok(());
            }
        }
    }

    let entry = keyring::Entry::new("dev.huakun.kuota", &format!("api_key:{}", provider))
        .map_err(|e| e.to_string())?;
    entry.set_password(&secret).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_keychain_password(provider: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("security")
            .arg("delete-generic-password")
            .arg("-s")
            .arg("dev.huakun.kuota")
            .arg("-a")
            .arg(format!("api_key:{}", provider))
            .status();
    }

    let entry = keyring::Entry::new("dev.huakun.kuota", &format!("api_key:{}", provider))
        .map_err(|e| e.to_string())?;
    let _ = entry.delete_credential();
    Ok(())
}

#[tauri::command]
pub fn open_dashboard_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    if let Some(tray_win) = app.get_webview_window("tray") {
        let _ = tray_win.hide();
    }
    Ok(())
}

#[tauri::command]
pub fn set_menu_bar_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_visible(visible);
    }
    Ok(())
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn send_desktop_notification(
    title: String,
    subtitle: Option<String>,
    body: String,
    sound: Option<bool>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let sound_clause = if sound.unwrap_or(true) {
            " sound name \"Purr\""
        } else {
            ""
        };
        let sub_clause = match subtitle {
            Some(s) => format!(" subtitle \"{}\"", s.replace('"', "\\\"")),
            None => "".to_string(),
        };
        let script = format!(
            "display notification \"{}\" with title \"{}\"{}{}",
            body.replace('"', "\\\""),
            title.replace('"', "\\\""),
            sub_clause,
            sound_clause
        );
        let _ = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status();
        return Ok(());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (title, subtitle, body, sound);
        Ok(())
    }
}

#[tauri::command]
pub async fn get_quota_history(
    from: Option<String>,
    to: Option<String>,
    provider: Option<String>,
    window: Option<String>,
) -> Result<Value, String> {
    let mut args = vec!["--json".to_string()];
    if let Some(f) = from {
        args.push("--from".to_string());
        args.push(f);
    }
    if let Some(t) = to {
        args.push("--to".to_string());
        args.push(t);
    }
    if let Some(p) = provider {
        args.push("--provider".to_string());
        args.push(p);
    }
    if let Some(w) = window {
        args.push("--window".to_string());
        args.push(w);
    }
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    execute_cli_subcommand("history", &str_args)
}

#[tauri::command]
pub async fn get_quota_forecast(
    provider: Option<String>,
    window: Option<String>,
    mode: Option<String>,
) -> Result<Value, String> {
    let mut args = vec!["--json".to_string()];
    if let Some(p) = provider {
        args.push("--provider".to_string());
        args.push(p);
    }
    if let Some(w) = window {
        args.push("--window".to_string());
        args.push(w);
    }
    if let Some(m) = mode {
        args.push("--mode".to_string());
        args.push(m);
    }
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    execute_cli_subcommand("forecast", &str_args)
}

#[tauri::command]
pub async fn collect_quota_snapshot() -> Result<Value, String> {
    execute_cli_subcommand("collect", &["--once", "--json"])
}
