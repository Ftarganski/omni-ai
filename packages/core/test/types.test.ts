import { describe, expect, it } from "vitest";
import type { ContentPart } from "../src/types.js";
import { contentToString } from "../src/types.js";

describe("contentToString", () => {
  it("returns a plain string directly", () => {
    expect(contentToString("hello world")).toBe("hello world");
  });

  it("joins text parts from a ContentPart array", () => {
    const parts: ContentPart[] = [
      { type: "text", text: "Hello " },
      { type: "text", text: "world" },
    ];
    expect(contentToString(parts)).toBe("Hello world");
  });

  it("renders image parts as [image:mime] placeholders", () => {
    const parts: ContentPart[] = [
      { type: "text", text: "See: " },
      { type: "image", mimeType: "image/png", data: "abc123" },
    ];
    expect(contentToString(parts)).toBe("See: [image:image/png]");
  });
});
