import { homedir, platform } from "node:os";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

export const KEYCHAIN_SERVICE = "dev.huakun.kuota";

export interface KuotaConfigFile {
  version: number;
  keys: Record<string, string>;
  endpoints?: Record<string, string>;
  visibility: Record<string, boolean>;
}

export function getConfigPath(): string {
  return join(homedir(), ".kuota", "config.json");
}

export function readKeychainPasswordSync(providerId: string): string | null {
  if (platform() === "darwin") {
    try {
      const stdout = execSync(
        `security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "api_key:${providerId}" -w`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 1500 },
      );
      const trimmed = stdout.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function writeKeychainPasswordSync(providerId: string, secret: string): boolean {
  if (platform() === "darwin") {
    try {
      execSync(
        `security add-generic-password -s "${KEYCHAIN_SERVICE}" -a "api_key:${providerId}" -w "${secret.replace(/"/g, '\\"')}" -U`,
        { stdio: ["pipe", "pipe", "ignore"], timeout: 2000 },
      );
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function deleteKeychainPasswordSync(providerId: string): boolean {
  if (platform() === "darwin") {
    try {
      execSync(
        `security delete-generic-password -s "${KEYCHAIN_SERVICE}" -a "api_key:${providerId}"`,
        { stdio: ["pipe", "pipe", "ignore"], timeout: 2000 },
      );
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function readConfigSync(): KuotaConfigFile {
  try {
    const p = getConfigPath();
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, "utf-8"));
      return {
        version: data.version || 1,
        keys: data.keys || {},
        endpoints: data.endpoints || {},
        visibility: data.visibility || {},
      };
    }
  } catch {
    // ignore
  }
  return { version: 1, keys: {}, endpoints: {}, visibility: {} };
}

export async function writeConfig(config: Partial<KuotaConfigFile>): Promise<KuotaConfigFile> {
  const current = readConfigSync();
  const updated: KuotaConfigFile = {
    version: 1,
    keys: { ...current.keys, ...config.keys },
    endpoints: { ...current.endpoints, ...config.endpoints },
    visibility: { ...current.visibility, ...config.visibility },
  };
  const dir = join(homedir(), ".kuota");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "config.json"), JSON.stringify(updated, null, 2), {
    mode: 0o600,
  });
  return updated;
}
