import { createFileRoute } from "@tanstack/react-router";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { REFERENCE_MINIMA, CATEGORIES, ARTICLE_TYPES } from "@/lib/article-schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/conditions")({
  head: () => ({ meta: [{ title: "Category conditions - Blogdel Admin" }] }),
  component: () => (
    <>
      <PageTitle eyebrow="Rules" title="Category conditions" description="Per-desk minimums a generation must meet before it can be validated." />
      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORIES.map(cat => (
          <Card key={cat}>
            <CardHeader><CardTitle className="text-sm eyebrow">{cat}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Minimum references:</span> {REFERENCE_MINIMA[cat] ?? 1}</div>
              <div><span className="text-muted-foreground">Allowed article types:</span> {ARTICLE_TYPES.join(", ")}</div>
              <div><span className="text-muted-foreground">Freshness:</span> {["politics","technology","business","sports","entertainment"].includes(cat) ? "current" : "evergreen ok"}</div>
              <div><span className="text-muted-foreground">Fabrication forbidden:</span> quotes, statistics, named entities without a reference</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  ),
});
