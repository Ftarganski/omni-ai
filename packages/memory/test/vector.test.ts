import { describe, expect, it } from "vitest";
import { cosineSimilarity, VectorIndex } from "../src/vector.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 when either vector is all zeros", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });

  it("handles higher-dimensional vectors", () => {
    const a = [0.1, 0.2, 0.3, 0.4];
    const b = [0.1, 0.2, 0.3, 0.4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1);
  });
});

describe("VectorIndex", () => {
  it("returns results sorted by descending score", () => {
    const idx = new VectorIndex<string>();
    idx.add("far", [0, 1]);
    idx.add("close", [1, 0.1]);
    const results = idx.query([1, 0], 2);
    expect(results[0].id).toBe("close");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("respects topK limit", () => {
    const idx = new VectorIndex<string>();
    for (let i = 0; i < 10; i++) idx.add(`doc${i}`, [Math.random(), Math.random()]);
    expect(idx.query([1, 0], 3)).toHaveLength(3);
  });

  it("remove() deletes an entry", () => {
    const idx = new VectorIndex<string>();
    idx.add("keep", [1, 0]);
    idx.add("remove-me", [1, 0]);
    idx.remove("remove-me");
    const ids = idx.query([1, 0], 10).map((r) => r.id);
    expect(ids).not.toContain("remove-me");
    expect(ids).toContain("keep");
  });

  it("clear() empties the index", () => {
    const idx = new VectorIndex<string>();
    idx.add("a", [1, 0]);
    idx.clear();
    expect(idx.size).toBe(0);
    expect(idx.query([1, 0])).toHaveLength(0);
  });

  it("size reflects the number of entries", () => {
    const idx = new VectorIndex<number>();
    expect(idx.size).toBe(0);
    idx.add(1, [1, 0]);
    idx.add(2, [0, 1]);
    expect(idx.size).toBe(2);
  });
});
