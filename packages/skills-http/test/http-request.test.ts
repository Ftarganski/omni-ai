import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpRequestSkill } from "../src/http-request.js";

function mockFetch(status: number, body: string, headers: Record<string, string> = {}): void {
  const responseHeaders = new Headers({ "content-type": "application/json", ...headers });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      statusText: status === 200 ? "OK" : "Error",
      ok: status >= 200 && status < 300,
      headers: responseHeaders,
      text: () => Promise.resolve(body),
    })
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpRequestSkill", () => {
  it("performs a basic GET request", async () => {
    mockFetch(200, '{"ok":true}');
    const result = await httpRequestSkill.execute({ url: "https://api.example.com/data" }, {} as never);
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.body).toBe('{"ok":true}');
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
  });

  it("sends Bearer auth header", async () => {
    mockFetch(200, "{}");
    await httpRequestSkill.execute(
      { url: "https://api.example.com/secure", auth: { type: "bearer", token: "my-token" } },
      {} as never
    );
    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my-token");
  });

  it("sends Basic auth header", async () => {
    mockFetch(200, "{}");
    await httpRequestSkill.execute(
      { url: "https://api.example.com/basic", auth: { type: "basic", username: "user", password: "pass" } },
      {} as never
    );
    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    const expected = `Basic ${Buffer.from("user:pass").toString("base64")}`;
    expect(headers.Authorization).toBe(expected);
  });

  it("serialises object body as JSON and sets Content-Type", async () => {
    mockFetch(201, '{"id":1}');
    await httpRequestSkill.execute(
      { url: "https://api.example.com/items", method: "POST", body: { name: "test" } },
      {} as never
    );
    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[1]?.body).toBe('{"name":"test"}');
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("returns ok:false for 4xx responses", async () => {
    mockFetch(404, "Not Found");
    const result = await httpRequestSkill.execute({ url: "https://api.example.com/missing" }, {} as never);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("fetches OAuth2 token before calling the API", async () => {
    const tokenBody = JSON.stringify({ access_token: "tok123", token_type: "Bearer" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers(),
          text: () => Promise.resolve(tokenBody),
          json: () => Promise.resolve(JSON.parse(tokenBody)),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: "OK",
          headers: new Headers({ "content-type": "application/json" }),
          text: () => Promise.resolve('{"data":1}'),
        })
    );

    const result = await httpRequestSkill.execute(
      {
        url: "https://api.example.com/resource",
        auth: {
          type: "oauth2-client-credentials",
          tokenUrl: "https://auth.example.com/token",
          clientId: "cid",
          clientSecret: "csec",
        },
      },
      {} as never
    );

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    const apiCall = vi.mocked(fetch).mock.calls[1];
    const apiHeaders = apiCall[1]?.headers as Record<string, string>;
    expect(apiHeaders.Authorization).toBe("Bearer tok123");
    expect(result.body).toBe('{"data":1}');
  });
});
