import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SkillContext } from "@omni-ai/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeImageSkill } from "../../src/multimodal/analyze-image.js";

// Minimal 1×1 white PNG (base64)
const TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

let tempDir: string;

function visionCtx(analysisResponse = "A white pixel."): SkillContext {
  return {
    provider: {
      name: "mock-vision",
      capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: true },
      complete: vi.fn().mockResolvedValue({
        content: analysisResponse,
        model: "mock",
        provider: "mock-vision",
      }),
    },
    config: {},
  };
}

function noVisionCtx(): SkillContext {
  return {
    provider: {
      name: "mock-no-vision",
      capabilities: { chat: true, embedding: false, streaming: false, toolUse: false, vision: false },
      complete: vi.fn(),
    },
    config: {},
  };
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-multimodal-"));
  const buf = Buffer.from(TINY_PNG_B64, "base64");
  await writeFile(join(tempDir, "image.png"), buf);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("analyzeImageSkill", () => {
  it("analyses an image from a file path", async () => {
    const ctx = visionCtx("A small white image.");
    const result = await analyzeImageSkill.execute(
      { imagePath: join(tempDir, "image.png"), prompt: "Describe this image" },
      ctx
    );
    expect(result.analysis).toBe("A small white image.");
    expect(ctx.provider.complete).toHaveBeenCalledOnce();
  });

  it("passes image as ContentPart[] to the provider", async () => {
    const ctx = visionCtx();
    await analyzeImageSkill.execute({ imagePath: join(tempDir, "image.png"), prompt: "What is this?" }, ctx);
    const req = (ctx.provider.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const content = req.messages[0].content as Array<{ type: string }>;
    expect(content.some((p) => p.type === "image")).toBe(true);
    expect(content.some((p) => p.type === "text")).toBe(true);
  });

  it("analyses an image from raw base64", async () => {
    const ctx = visionCtx("Tiny image.");
    const result = await analyzeImageSkill.execute(
      { imageBase64: TINY_PNG_B64, mimeType: "image/png", prompt: "Describe" },
      ctx
    );
    expect(result.analysis).toBe("Tiny image.");
  });

  it("throws when provider does not support vision", async () => {
    const ctx = noVisionCtx();
    await expect(
      analyzeImageSkill.execute({ imagePath: join(tempDir, "image.png"), prompt: "Describe" }, ctx)
    ).rejects.toThrow("does not support vision");
  });

  it("throws when no image source is provided", async () => {
    const ctx = visionCtx();
    await expect(analyzeImageSkill.execute({ prompt: "Describe" } as never, ctx)).rejects.toThrow();
  });
});
