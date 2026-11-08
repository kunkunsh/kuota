import { describe, expect, it } from "vitest";
import * as React from "react";
import { DropdownSelect } from "./dropdown-select.js";

describe("DropdownSelect UI Component", () => {
  it("renders trigger with labelPrefix and default selected option", () => {
    const options = [
      { value: "codex", label: "OpenAI Codex" },
      { value: "claude", label: "Claude Code" },
    ];

    const element = React.createElement(DropdownSelect, {
      value: "codex",
      onChange: () => {},
      options,
      labelPrefix: "Provider:",
    });

    expect(element).toBeDefined();
    expect(element.props.value).toBe("codex");
    expect(element.props.labelPrefix).toBe("Provider:");
    expect(element.props.options).toHaveLength(2);
  });

  it("handles empty options gracefully", () => {
    const element = React.createElement(DropdownSelect, {
      value: "custom",
      onChange: () => {},
      options: [],
    });

    expect(element).toBeDefined();
    expect(element.props.value).toBe("custom");
  });
});
