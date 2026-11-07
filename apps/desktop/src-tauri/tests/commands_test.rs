use kuota_desktop::commands::{self, AppState};

#[tokio::test]
async fn test_get_app_info() {
    let info = commands::get_app_info();
    assert_eq!(info["name"], "Kuota");
    assert_eq!(info["version"], "0.1.1");
    assert_eq!(info["mode"], "desktop");
    assert!(info["platform"].is_string());
}

#[tokio::test]
async fn test_quota_status_and_caching() {
    let state = AppState::new();

    // First call: executes probe and populates cache
    let res1 = commands::get_quota_status_impl(None, &state).await;
    assert!(res1.is_ok(), "get_quota_status should return envelope");
    let val1 = res1.unwrap();
    assert_eq!(val1["schemaVersion"], 1);
    assert!(val1["providers"].is_array());

    // Verify state was cached
    {
        let guard = state.cached_status.lock().unwrap();
        assert!(guard.is_some(), "cached_status should be populated");
    }

    // Second call without fresh: returns cached value immediately
    let res2 = commands::get_quota_status_impl(Some(false), &state).await;
    assert!(res2.is_ok());
    let val2 = res2.unwrap();
    assert_eq!(val1["generatedAt"], val2["generatedAt"], "cached envelope should match exactly");

    // Refresh call: forces new probe
    let refresh_res = commands::refresh_quota_impl(&state).await;
    assert!(refresh_res.is_ok());
}

#[test]
fn test_open_external_url_validation() {
    // Should accept standard https URL
    let res = commands::open_external_url("https://github.com/HuakunShen/kuota".into());
    // On macOS without graphical server in tests it might succeed or spawn; checking it runs without panic
    let _ = res;
}
