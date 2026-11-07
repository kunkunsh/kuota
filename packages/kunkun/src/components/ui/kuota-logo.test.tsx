import * as React from "react";
import { describe, expect, it } from "vitest";
import { KuotaLogo, KuotaWordmark } from "./kuota-logo.js";

describe("KuotaLogo SVG Component", () => {
  it("renders pure vector SVG mark with correct viewBox", () => {
    const el = <KuotaLogo size={24} />;
    expect(React.isValidElement(el)).toBe(true);

    const rendered = KuotaLogo({ size: 24, theme: "dark" });
    expect(React.isValidElement(rendered)).toBe(true);
    expect(rendered.type).toBe("svg");
    expect(rendered.props.viewBox).toBe("0 0 128 128");
    expect(rendered.props.width).toBe(24);
    expect(rendered.props.height).toBe(24);
  });

  it("renders dark theme colors without squircle background by default", () => {
    const rendered = KuotaLogo({ theme: "dark", withBackground: false });
    const children = React.Children.toArray(rendered.props.children) as React.ReactElement<any>[];

    // When withBackground is false, no <rect> is rendered
    const rect = children.find((c) => c.type === "rect");
    expect(rect).toBeUndefined();

    // Group containing vector paths
    const group = children.find((c) => c.type === "g");
    expect(group).toBeDefined();

    const paths = React.Children.toArray(group?.props?.children) as React.ReactElement<any>[];
    // Stem, diagonal, quota arc, pace tick
    expect(paths.length).toBeGreaterThanOrEqual(3);

    const stem = paths[0];
    const diagonal = paths[1];
    const arc = paths[2];

    expect(stem?.props?.stroke).toBe("#F6F8F5"); // Ivory dark glyph
    expect(diagonal?.props?.stroke).toBe("#F6F8F5");
    expect(arc?.props?.stroke).toBe("#36D7A2"); // Mint quota arc
  });

  it("renders light theme colors (#1C2026 graphite glyph) when theme='light'", () => {
    const rendered = KuotaLogo({ theme: "light", withBackground: false });
    const children = React.Children.toArray(rendered.props.children) as React.ReactElement<any>[];
    const group = children.find((c) => c.type === "g");
    const paths = React.Children.toArray(group?.props?.children) as React.ReactElement<any>[];

    const stem = paths[0];
    const diagonal = paths[1];
    const arc = paths[2];

    expect(stem?.props?.stroke).toBe("#1C2026"); // Graphite light glyph
    expect(diagonal?.props?.stroke).toBe("#1C2026");
    expect(arc?.props?.stroke).toBe("#36D7A2"); // Mint quota arc is consistent
  });

  it("renders squircle container when withBackground is true", () => {
    const darkWithBg = KuotaLogo({ theme: "dark", withBackground: true });
    const darkChildren = React.Children.toArray(
      darkWithBg.props.children,
    ) as React.ReactElement<any>[];
    const darkRect = darkChildren.find((c) => c.type === "rect");
    expect(darkRect).toBeDefined();
    expect(darkRect?.props?.fill).toBe("#15181D");

    const lightWithBg = KuotaLogo({ theme: "light", withBackground: true });
    const lightChildren = React.Children.toArray(
      lightWithBg.props.children,
    ) as React.ReactElement<any>[];
    const lightRect = lightChildren.find((c) => c.type === "rect");
    expect(lightRect).toBeDefined();
    expect(lightRect?.props?.fill).toBe("#C3CAC6");
  });

  it("KuotaWordmark renders logo and brand title", () => {
    const wordmark = <KuotaWordmark theme="dark" size={20} />;
    expect(React.isValidElement(wordmark)).toBe(true);
  });
});
