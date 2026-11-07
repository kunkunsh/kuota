use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde_json::Value;
use tauri::State;

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

fn execute_probe() -> Result<Value, String> {
    let augmented_path = get_augmented_path();
    let repo_root = find_repo_root();

    // Candidate 1: bun packages/cli/src/main.ts status --json
    if let Some(ref root) = repo_root {
        let bun_path = find_binary("bun").unwrap_or_else(|| PathBuf::from("bun"));
        let cli_script = root.join("packages").join("cli").join("src").join("main.ts");
        if cli_script.exists() {
            let output = Command::new(&bun_path)
                .arg(&cli_script)
                .arg("status")
                .arg("--json")
                .env("PATH", &augmented_path)
                .current_dir(root)
                .output();

            if let Ok(out) = output {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        return Ok(v);
                    }
                }
            }
        }

        // Candidate 2: node packages/cli/dist/main.mjs status --json
        let node_path = find_binary("node").unwrap_or_else(|| PathBuf::from("node"));
        let dist_script = root.join("packages").join("cli").join("dist").join("main.mjs");
        if dist_script.exists() {
            let output = Command::new(&node_path)
                .arg(&dist_script)
                .arg("status")
                .arg("--json")
                .env("PATH", &augmented_path)
                .current_dir(root)
                .output();

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
    let output = Command::new(&kuota_path)
        .arg("status")
        .arg("--json")
        .env("PATH", &augmented_path)
        .output();

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
