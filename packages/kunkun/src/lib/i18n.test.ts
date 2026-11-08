import { describe, expect, it } from "vitest";
import { translations, type Language } from "./i18n.js";

describe("i18n translations", () => {
  it("provides comprehensive translations for English and Chinese", () => {
    expect(translations.en).toBeDefined();
    expect(translations.zh).toBeDefined();
    expect(Object.keys(translations.en).length).toBeGreaterThan(40);
    expect(Object.keys(translations.zh).length).toBeGreaterThan(40);
  });

  it("has matching keys in both language dictionaries", () => {
    const enKeys = Object.keys(translations.en).sort();
    const zhKeys = Object.keys(translations.zh).sort();

    for (const key of enKeys) {
      expect(translations.zh[key]).toBeDefined();
      expect(typeof translations.zh[key]).toBe("string");
      expect(translations.zh[key].length).toBeGreaterThan(0);
    }
  });

  it("contains required update check and pacing strings in Chinese", () => {
    expect(translations.zh["update.check"]).toBe("检查更新");
    expect(translations.zh["update.up_to_date"]).toBe("已是最新版本");
    expect(translations.zh["pacing.overspent"]).toBe("消耗过快");
    expect(translations.zh["pacing.on_pace"]).toBe("节奏良好");
  });
});
