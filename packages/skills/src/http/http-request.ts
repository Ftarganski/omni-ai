import type { ISkill } from "@omni-ai/core";
import { z } from "zod";

const BearerAuthSchema = z.object({
  type: z.literal("bearer"),
  token: z.string().describe("Bearer token value"),
});

const BasicAuthSchema = z.object({
  type: z.literal("basic"),
  username: z.string(),
  password: z.string(),
});

const OAuth2ClientSchema = z.object({
  type: z.literal("oauth2-client-credentials"),
  tokenUrl: z.string().url().describe("Token endpoint URL"),
  clientId: z.string(),
  clientSecret: z.string(),
  scope: z.string().optional().describe("Space-separated OAuth2 scopes"),
});

const AuthSchema = z.discriminatedUnion("type", [BearerAuthSchema, BasicAuthSchema, OAuth2ClientSchema]);

const InputSchema = z.object({
  url: z.string().url().describe("Target URL"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).default("GET").describe("HTTP method"),
  headers: z.record(z.string()).optional().describe("Additional request headers"),
  body: z
    .union([z.string(), z.record(z.unknown())])
    .optional()
    .describe("Request body — string or JSON object"),
  auth: AuthSchema.optional().describe("Authentication configuration"),
  timeoutMs: z.number().int().positive().default(30_000).describe("Request timeout in milliseconds"),
});

export type HttpRequestInput = z.infer<typeof InputSchema>;

export interface HttpRequestOutput {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
}

async function resolveToken(auth: z.infer<typeof AuthSchema>): Promise<string> {
  if (auth.type === "bearer") return `Bearer ${auth.token}`;

  if (auth.type === "basic") {
    const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString("base64");
    return `Basic ${encoded}`;
  }

  // OAuth2 client credentials
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
  });
  if (auth.scope) params.set("scope", auth.scope);

  const tokenRes = await fetch(auth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`OAuth2 token request failed: ${tokenRes.status} ${tokenRes.statusText}`);
  }

  const json = (await tokenRes.json()) as { access_token?: string; token_type?: string };
  if (!json.access_token) throw new Error("OAuth2 response did not include access_token");
  const tokenType = json.token_type ?? "Bearer";
  return `${tokenType} ${json.access_token}`;
}

export const httpRequestSkill: ISkill<HttpRequestInput, HttpRequestOutput> = {
  name: "http-request",
  description:
    "Make an authenticated HTTP request to any URL. Supports Bearer token, HTTP Basic, and OAuth2 client-credentials flows. Returns status, headers and body. Use this to call external REST APIs from an agent.",

  async execute(input: HttpRequestInput): Promise<HttpRequestOutput> {
    const { url, method, headers: extraHeaders, body, auth, timeoutMs } = InputSchema.parse(input);

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...extraHeaders,
    };

    if (auth) {
      headers.Authorization = await resolveToken(auth);
    }

    let bodyStr: string | undefined;
    if (body !== undefined) {
      if (typeof body === "string") {
        bodyStr = body;
      } else {
        bodyStr = JSON.stringify(body);
        headers["Content-Type"] ??= "application/json";
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: bodyStr,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const responseBody = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      ok: response.ok,
    };
  },
};
