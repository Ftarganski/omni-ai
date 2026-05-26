import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { ImageContentPart, ISkill, SkillContext } from "@omni-ai/core";
import { z } from "zod";

const SUPPORTED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type SupportedMime = (typeof SUPPORTED_MIME)[number];

const InputSchema = z
  .object({
    prompt: z.string().describe("Question or instruction for the vision model, e.g. 'Describe this screenshot'"),
    imagePath: z.string().optional().describe("Absolute or relative path to an image file on disk"),
    imageUrl: z.string().url().optional().describe("Public URL of an image to fetch and analyse"),
    imageBase64: z.string().optional().describe("Base64-encoded image data (without data-URL prefix)"),
    mimeType: z
      .enum(SUPPORTED_MIME)
      .optional()
      .describe("MIME type — required when using imageBase64, inferred from extension otherwise"),
  })
  .refine((d) => d.imagePath ?? d.imageUrl ?? d.imageBase64, {
    message: "Provide exactly one of: imagePath, imageUrl, or imageBase64",
  });

export type AnalyzeImageInput = z.infer<typeof InputSchema>;

export interface AnalyzeImageOutput {
  analysis: string;
}

const EXT_TO_MIME: Record<string, SupportedMime> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

async function loadImage(input: z.infer<typeof InputSchema>): Promise<{ data: string; mimeType: SupportedMime }> {
  if (input.imagePath) {
    const ext = extname(input.imagePath).toLowerCase();
    const mimeType = input.mimeType ?? EXT_TO_MIME[ext];
    if (!mimeType) throw new Error(`Unsupported image extension "${ext}". Use: ${Object.keys(EXT_TO_MIME).join(", ")}`);
    const data = (await readFile(input.imagePath)).toString("base64");
    return { data, mimeType };
  }

  if (input.imageUrl) {
    const res = await fetch(input.imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get("content-type") ?? "";
    const mimeType = (input.mimeType ?? (SUPPORTED_MIME.find((m) => contentType.startsWith(m)) as SupportedMime));
    if (!mimeType) throw new Error(`Unsupported content-type "${contentType}"`);
    const buffer = await res.arrayBuffer();
    return { data: Buffer.from(buffer).toString("base64"), mimeType };
  }

  // imageBase64
  const mimeType = input.mimeType;
  if (!mimeType) throw new Error("mimeType is required when supplying imageBase64");
  return { data: input.imageBase64 as string, mimeType };
}

export const analyzeImageSkill: ISkill<AnalyzeImageInput, AnalyzeImageOutput> = {
  name: "analyze-image",
  description:
    "Analyse an image (screenshot, diagram, mockup, photo) using the configured vision-capable LLM provider. Accepts a file path, public URL, or raw base64 data. Returns a natural-language description or answer to your prompt.",

  async execute(input: AnalyzeImageInput, ctx: SkillContext): Promise<AnalyzeImageOutput> {
    const parsed = InputSchema.parse(input);

    if (!ctx.provider.capabilities.vision) {
      throw new Error(
        `Provider "${ctx.provider.name}" does not support vision. ` +
          "Configure a vision-capable provider (e.g. Anthropic claude-3, OpenAI gpt-4o)."
      );
    }

    const { data, mimeType } = await loadImage(parsed);

    const imagePart: ImageContentPart = { type: "image", mimeType, data };

    const response = await ctx.provider.complete({
      messages: [
        {
          role: "user",
          content: [imagePart, { type: "text", text: parsed.prompt }],
        },
      ],
      temperature: 0.2,
    });

    return { analysis: response.content };
  },
};
