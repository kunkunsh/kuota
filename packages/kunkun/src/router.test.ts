import { describe, expect, it } from "vitest";
import { createKuotaRouter } from "./router.js";

describe("TanStack Router Architecture for Kuota", () => {
  it("creates a router with comprehensive route tree using memory/hash history", () => {
    const router = createKuotaRouter("/overview");
    expect(router).toBeDefined();

    // Check matched routes and route hierarchy
    const flatRoutes = Object.keys(router.routesById);
    expect(flatRoutes).toContain("__root__");
    expect(flatRoutes).toContain("/dashboard-layout");
    expect(flatRoutes).toContain("/dashboard-layout/");
    expect(flatRoutes).toContain("/dashboard-layout/overview");
    expect(flatRoutes).toContain("/dashboard-layout/history");
    expect(flatRoutes).toContain("/dashboard-layout/detail");
    expect(flatRoutes).toContain("/dashboard-layout/connections");
    expect(flatRoutes).toContain("/dashboard-layout/usage");
    expect(flatRoutes).toContain("/dashboard-layout/projects");
    expect(flatRoutes).toContain("/dashboard-layout/benchmarks");
    expect(flatRoutes).toContain("/dashboard-layout/data");
    expect(flatRoutes).toContain("/dashboard-layout/alerts");
    expect(flatRoutes).toContain("/dashboard-layout/settings");
    expect(flatRoutes).toContain("/dashboard-layout/island");
    expect(flatRoutes).toContain("/popover");
  });

  it("supports standalone popover route outside dashboard layout", () => {
    const router = createKuotaRouter("/popover");
    expect(router).toBeDefined();
    expect(router.routesById["/popover"]).toBeDefined();
    // /popover parent is __root__, not dashboard-layout
    expect(router.routesById["/popover"].parentRoute?.id).toBe("__root__");
  });

  it("nests main dashboard routes under the layout route", () => {
    const router = createKuotaRouter("/settings");
    const settingsRoute = router.routesById["/dashboard-layout/settings"];
    expect(settingsRoute).toBeDefined();
    expect(settingsRoute.parentRoute?.id).toBe("/dashboard-layout");
  });

  it("handles initial routes without leading slash gracefully", () => {
    const router = createKuotaRouter("history");
    expect(router).toBeDefined();
    expect(router.history).toBeDefined();
  });
});
