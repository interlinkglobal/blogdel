import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/blogdel/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/schema")({
  head: () => ({ meta: [{ title: "Schema - Blogdel Admin" }] }),
  component: SchemaPage,
});

const SOURCE_INPUT = `{
  "category": "technology",
  "source_type": "api|dataset|website|evergreen",
  "prompt": "Editorial prompt for the model...",
  "context": { "headline": "...", "summary": "...", "entities": [] },
  "references": [
    { "provider": "nyt", "title": "...", "url": "https://...", "authority": "primary" }
  ],
  "instructions": {
    "article_type": "news|analysis|explainer|list|profile|history|guide",
    "tone": "clear",
    "target_length": 900,
    "audience": "general",
    "freshness": "current",
    "avoid": []
  }
}`;

const ARTICLE_OUTPUT = `{
  "slug": "kebab-case-slug",
  "category": "technology",
  "title": "8–160 chars",
  "description": "30–320 chars",
  "body_markdown": "≥500 chars, Markdown with ## H2s",
  "article_type": "news",
  "language": "en",
  "keywords": ["up to 12"],
  "references": [
    { "provider": "nyt", "title": "...", "url": "https://...", "authority": "primary" }
  ]
}`;

function SchemaPage() {
  return (
    <>
      <PageTitle eyebrow="Contract" title="Article schema" description="The stable contract every model output must satisfy. Validation happens before an article is written to the database." />
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Source input</div>
          <pre className="text-xs bg-muted p-4 rounded border border-border overflow-x-auto">{SOURCE_INPUT}</pre>
        </div>
        <div>
          <div className="eyebrow mb-2">Article output</div>
          <pre className="text-xs bg-muted p-4 rounded border border-border overflow-x-auto">{ARTICLE_OUTPUT}</pre>
        </div>
      </div>
      <div className="mt-8 text-sm text-muted-foreground max-w-2xl">
        Validation is enforced with Zod on the server. Invalid outputs never reach the articles table; they are stored on the delegation job with the specific error and the job is marked failed for retry.
      </div>
    </>
  );
}
