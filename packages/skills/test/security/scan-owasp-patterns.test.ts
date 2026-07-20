import { describe, expect, it } from "vitest";
import { scanOwaspPatternsSkill } from "../../src/security/scan-owasp-patterns.js";

describe("scanOwaspPatternsSkill", () => {
  it("flags SQL injection via string interpolation into query()", async () => {
    const result = await scanOwaspPatternsSkill.execute(
      { content: "db.query(`SELECT * FROM users WHERE id = ${id}`)" },
      {} as never
    );
    expect(result.clean).toBe(false);
    expect(result.findings[0]).toMatchObject({
      rule: "sql-injection",
      category: "A03:2021-Injection",
      severity: "high",
    });
  });

  it("flags XSS via dangerouslySetInnerHTML", async () => {
    const result = await scanOwaspPatternsSkill.execute(
      { content: "<div dangerouslySetInnerHTML={{ __html: userInput }} />" },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "xss-dangerous-html")).toBe(true);
  });

  it("flags XSS via innerHTML assignment", async () => {
    const result = await scanOwaspPatternsSkill.execute({ content: "el.innerHTML = userInput;" }, {} as never);
    expect(result.findings.some((f) => f.rule === "xss-dangerous-html")).toBe(true);
  });

  it("flags command injection via execSync with a template literal", async () => {
    const result = await scanOwaspPatternsSkill.execute({ content: "execSync(`rm -rf ${target}`)" }, {} as never);
    expect(result.findings.some((f) => f.rule === "command-injection")).toBe(true);
  });

  it("flags dynamic code execution via eval", async () => {
    const result = await scanOwaspPatternsSkill.execute({ content: "eval(userInput);" }, {} as never);
    expect(result.findings.some((f) => f.rule === "dynamic-code-execution")).toBe(true);
  });

  it("flags SSRF via fetch with a concatenated URL", async () => {
    const result = await scanOwaspPatternsSkill.execute({ content: "fetch(baseUrl + userPath)" }, {} as never);
    expect(
      result.findings.some((f) => f.rule === "ssrf-dynamic-url" && f.category.includes("Server-Side Request Forgery"))
    ).toBe(true);
  });

  it("flags path traversal via readFile with a dynamic path", async () => {
    const result = await scanOwaspPatternsSkill.execute(
      { content: "readFileSync(basePath + userFilename)" },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "path-traversal")).toBe(true);
  });

  it("flags a hardcoded credential comparison", async () => {
    const result = await scanOwaspPatternsSkill.execute(
      { content: 'if (password === "admin123") { grantAccess(); }' },
      {} as never
    );
    expect(result.findings.some((f) => f.rule === "hardcoded-credential-check")).toBe(true);
  });

  it("returns clean: true for safe, parameterized code", async () => {
    const result = await scanOwaspPatternsSkill.execute(
      { content: "db.query('SELECT * FROM users WHERE id = $1', [id]);" },
      {} as never
    );
    expect(result.clean).toBe(true);
    expect(result.findings).toHaveLength(0);
  });
});
