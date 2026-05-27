import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeComponentSkill } from "../../src/frontend/analyze-component.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "omni-analyze-component-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const sampleComponent = `
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  const theme = useTheme();
  const id = useId();
  return <button id={id}>{label}</button>;
}

export const VERSION = '1.0.0';

export default Button;
`;

const hookComponent = `
import { useState, useEffect } from 'react';

type OrdersProps = { id: string };

export const OrdersWidget = ({ id }: OrdersProps) => {
  const [data, setData] = useState(null);
  useEffect(() => {}, [id]);
  return null;
};
`;

describe("analyzeComponentSkill", () => {
  it("extracts component name from function declaration", async () => {
    const file = join(tempDir, "Button.tsx");
    await writeFile(file, sampleComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.componentName).toBe("Button");
  });

  it("extracts props interface", async () => {
    const file = join(tempDir, "Button.tsx");
    await writeFile(file, sampleComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.propsInterface).toContain("ButtonProps");
  });

  it("extracts hooks used", async () => {
    const file = join(tempDir, "Button.tsx");
    await writeFile(file, sampleComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.hooksUsed).toContain("useTheme");
    expect(result.hooksUsed).toContain("useId");
  });

  it("deduplicates hooks", async () => {
    const src = `
      export function Comp() {
        const a = useTheme();
        const b = useTheme();
        return null;
      }
    `;
    const file = join(tempDir, "Comp.tsx");
    await writeFile(file, src, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.hooksUsed.filter((h) => h === "useTheme")).toHaveLength(1);
  });

  it("extracts named exports", async () => {
    const file = join(tempDir, "Button.tsx");
    await writeFile(file, sampleComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.namedExports).toContain("Button");
    expect(result.namedExports).toContain("VERSION");
  });

  it("detects default export", async () => {
    const file = join(tempDir, "Button.tsx");
    await writeFile(file, sampleComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.hasDefaultExport).toBe(true);
  });

  it("returns false for hasDefaultExport when missing", async () => {
    const file = join(tempDir, "OrdersWidget.tsx");
    await writeFile(file, hookComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.hasDefaultExport).toBe(false);
  });

  it("extracts type alias props", async () => {
    const file = join(tempDir, "OrdersWidget.tsx");
    await writeFile(file, hookComponent, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.propsInterface).toContain("OrdersProps");
  });

  it("returns null propsInterface when no props found", async () => {
    const src = `export function NoProps() { return null; }`;
    const file = join(tempDir, "NoProps.tsx");
    await writeFile(file, src, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.propsInterface).toBeNull();
  });

  it("falls back to filename when no named component", async () => {
    const src = `const x = 1;`;
    const file = join(tempDir, "MyWidget.tsx");
    await writeFile(file, src, "utf-8");
    const result = await analyzeComponentSkill.execute({ path: file }, {} as never);
    expect(result.componentName).toBe("MyWidget");
  });
});
