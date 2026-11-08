export interface UpdateResult {
  currentVersion: string;
  available: boolean;
  targetVersion?: string;
  body?: string;
  date?: string;
  error?: string;
}

export const CURRENT_APP_VERSION = "0.1.2";

/**
 * Checks for updates both in native desktop (via Tauri v2 updater)
 * and in web mode (via GitHub releases API).
 */
export async function checkForUpdates(): Promise<UpdateResult> {
  const isDesktop =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isDesktop) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = (await invoke("check_for_updates")) as any;
      return {
        currentVersion: info.current_version || CURRENT_APP_VERSION,
        available: Boolean(info.available),
        targetVersion: info.target_version,
        body: info.body,
        date: info.date,
      };
    } catch (err) {
      console.warn("Tauri updater check failed, falling back to GitHub API check:", err);
    }
  }

  // Web fallback or GitHub API check
  try {
    const res = await fetch("https://api.github.com/repos/kunkunsh/kuota/releases/latest", {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      const tagName: string = data.tag_name || "";
      // Strip 'app-v' or 'v'
      const cleanTarget = tagName
        .replace(/^app-v/, "")
        .replace(/^v/, "")
        .trim();

      const isNewer = compareSemver(cleanTarget, CURRENT_APP_VERSION) > 0;
      return {
        currentVersion: CURRENT_APP_VERSION,
        available: isNewer,
        targetVersion: cleanTarget,
        body: data.body,
        date: data.published_at,
      };
    }
  } catch (err) {
    return {
      currentVersion: CURRENT_APP_VERSION,
      available: false,
      error: String(err),
    };
  }

  return {
    currentVersion: CURRENT_APP_VERSION,
    available: false,
  };
}

/**
 * Installs update in native desktop or redirects to download in web mode
 */
export async function installUpdate(): Promise<{ success: boolean; message?: string }> {
  const isDesktop =
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isDesktop) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("install_update");
      return { success: true, message: "Update downloaded. Restart application to complete." };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  }

  // In web mode, open the releases download page
  if (typeof window !== "undefined") {
    window.open(
      "https://github.com/kunkunsh/kuota/releases/latest",
      "_blank",
      "noopener,noreferrer",
    );
  }
  return { success: true };
}

function compareSemver(v1: string, v2: string): number {
  const p1 = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}
