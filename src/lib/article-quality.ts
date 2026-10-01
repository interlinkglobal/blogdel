import type { ArticleOutput, SourceInput } from "./article-schema";

export type ArticleQualityCheck = {
  publishable: boolean;
  reasons: string[];
  wordCount: number;
};

function normalizedWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
}

function titleSimilarity(left: string, right: string): number {
  const a = new Set(normalizedWords(left));
  const b = new Set(normalizedWords(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / new Set([...a, ...b]).size;
}

export function checkArticleQuality(
  article: ArticleOutput,
  input: SourceInput,
  recentTitles: string[],
): ArticleQualityCheck {
  const reasons: string[] = [];
  const words = article.body_markdown.trim().split(/\s+/).filter(Boolean).length;
  const headings = article.body_markdown.match(/^##\s+.+$/gm) ?? [];
  const facts = input.context?.facts ?? [];
  const hasSummary = (input.context?.summary?.trim().length ?? 0) >= 120;
  const evidenceUrls = new Set(input.references.map((reference) => reference.url));
  const sourcedFacts = facts.filter((fact) => fact.claim.trim().length >= 20 && fact.source_ref && evidenceUrls.has(fact.source_ref));

  if (words < 650) reasons.push("body_under_650_words");
  if (headings.length < 3) reasons.push("fewer_than_3_sections");
  if (article.category !== input.category) reasons.push("category_mismatch");
  if (!hasSummary && sourcedFacts.length < 3) reasons.push("insufficient_source_evidence");
  if (input.references.length < 2) reasons.push("fewer_than_2_source_references");

  const references = article.references ?? [];
  const distinctUrls = new Set(references.map((reference) => reference.url));
  if (references.length !== input.references.length || distinctUrls.size !== input.references.length) {
    reasons.push("references_do_not_match_source_set");
  }
  if (references.some((reference) => {
    try {
      return new URL(reference.url).protocol !== "https:" || !evidenceUrls.has(reference.url);
    } catch {
      return true;
    }
  })) reasons.push("invalid_or_unprovided_reference");

  if (recentTitles.some((title) => titleSimilarity(article.title, title) >= 0.72)) {
    reasons.push("recent_title_overlap");
  }

  return { publishable: reasons.length === 0, reasons, wordCount: words };
}
