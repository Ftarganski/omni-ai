export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface VectorEntry<T> {
  id: T;
  vector: number[];
}

/**
 * In-memory vector index for nearest-neighbour search by cosine similarity.
 * Suitable for small-to-medium datasets (up to a few thousand vectors).
 */
export class VectorIndex<T = string> {
  private entries: VectorEntry<T>[] = [];

  add(id: T, vector: number[]): void {
    this.entries.push({ id, vector });
  }

  query(queryVector: number[], topK = 5): Array<{ id: T; score: number }> {
    return this.entries
      .map((e) => ({ id: e.id, score: cosineSimilarity(queryVector, e.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  remove(id: T): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}
