import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecretsSkill } from "../../src/security/scan-secrets.js";

describe("scanSecretsSkill", () => {
  it("flags an AWS access key", async () => {
    const result = await scanSecretsSkill.execute({ content: "AWS_KEY=AKIAABCDEFGHIJKLMNOP" }, {} as never);
    expect(result.clean).toBe(false);
    expect(result.findings[0].rule).toBe("aws-access-key");
  });

  it("flags a private key block", async () => {
    const result = await scanSecretsSkill.execute({ content: "-----BEGIN RSA PRIVATE KEY-----" }, {} as never);
    expect(result.findings.some((f) => f.rule === "private-key-block")).toBe(true);
  });

  it("flags a GitHub token", async () => {
    const result = await scanSecretsSkill.execute(
      { content: "token=ghp_1234567890abcdefghijklmnopqrstuvwx" },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "github-token")).toBe(true);
  });

  it("flags a JWT", async () => {
    const result = await scanSecretsSkill.execute(
      { content: "auth: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYb4v" },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "jwt")).toBe(true);
  });

  it("flags a generic secret assignment", async () => {
    const result = await scanSecretsSkill.execute(
      { content: 'const apiKey = "sk_live_abcdefghijklmnop1234";' },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "generic-secret-assignment")).toBe(true);
  });

  it("flags a connection string with embedded credentials", async () => {
    const result = await scanSecretsSkill.execute(
      { content: "postgres://admin:sup3rSecret@db.internal:5432/prod" },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "connection-string-credentials")).toBe(true);
  });

  it("masks the secret value in the returned snippet", async () => {
    const result = await scanSecretsSkill.execute({ content: "AWS_KEY=AKIAABCDEFGHIJKLMNOP" }, {} as never);
    expect(result.findings[0].snippet).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(result.findings[0].snippet).toContain("[REDACTED]");
  });

  it("returns clean: true for text with no matching patterns", async () => {
    const result = await scanSecretsSkill.execute({ content: "const greeting = 'hello world';" }, {} as never);
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it("reads from a file when path is provided instead of content", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "omni-scan-secrets-"));
    try {
      const filePath = join(tempDir, ".env");
      await writeFile(filePath, "AWS_KEY=AKIAABCDEFGHIJKLMNOP", "utf-8");
      const result = await scanSecretsSkill.execute({ path: filePath }, {} as never);
      expect(result.clean).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects when neither content nor path is provided", async () => {
    await expect(scanSecretsSkill.execute({}, {} as never)).rejects.toThrow();
  });
});
