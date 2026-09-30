export type FeedInput = { category?: string; subcategory?: string; author?: string; type?: string; q?: string; sort?: "newest" | "oldest" | "relevance"; cursor?: string; perPage?: number };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) throw new Error("Invalid request");
  return value.trim();
}
export function validateFeedInput(value: unknown): FeedInput {
  const source = record(value);
  const result: FeedInput = {};
  for (const field of ["category", "subcategory", "author", "type", "cursor"] as const) {
    if (source[field] !== undefined) {
      const v = text(source[field], 160);
      if (!v || !/^[a-zA-Z0-9_-]+$/.test(v)) throw new Error("Invalid request");
      result[field] = v;
    }
  }
  if (source["q"] !== undefined) result.q = text(source["q"], 200);
  if (source["sort"] !== undefined) {
    const v = source["sort"];
    if (v !== "newest" && v !== "oldest" && v !== "relevance") throw new Error("Invalid request");
    result.sort = v;
  }
  if (source["perPage"] !== undefined) {
    const v = source["perPage"];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 48) throw new Error("Invalid request");
    result.perPage = v;
  }
  for (const key of Object.keys(source)) {
    if (!["category", "subcategory", "author", "type", "q", "sort", "cursor", "perPage"].includes(key)) throw new Error("Invalid request");
  }
  return result;
}

