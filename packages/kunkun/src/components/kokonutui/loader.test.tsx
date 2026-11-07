import * as React from "react";
import { describe, expect, it } from "vitest";
import { Loader } from "./loader.js";

describe("Kokonut UI Loader Component", () => {
  it("renders loader element with animated rings", () => {
    const el = <Loader size="md" title="Testing loader" subtitle="Please wait" />;
    expect(React.isValidElement(el)).toBe(true);

    const rendered = Loader({ size: "md", title: "Testing loader", subtitle: "Please wait" });
    expect(React.isValidElement(rendered)).toBe(true);
    expect(rendered.type).toBe("div");
  });

  it("supports size='xs' for compact button spinning state", () => {
    const rendered = Loader({ size: "xs", variant: "emerald" });
    expect(React.isValidElement(rendered)).toBe(true);
    const children = React.Children.toArray(rendered.props.children) as React.ReactElement<any>[];
    const ringContainer = children[0];
    expect(ringContainer?.props?.className).toContain("size-5");
    expect(ringContainer?.props?.className).toContain("text-emerald-400");
  });

  it("renders title and subtitle when provided", () => {
    const rendered = Loader({
      size: "sm",
      title: "Syncing Antigravity quota",
      subtitle: "Sampling live telemetry",
    });
    const text = JSON.stringify(rendered.props);
    expect(text).toContain("Syncing Antigravity quota");
    expect(text).toContain("Sampling live telemetry");
  });
});
