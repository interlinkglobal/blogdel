import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { listAllArticles, updateArticleStatus } from "@/lib/admin.functions";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { STATUS_LABELS, formatDateTime } from "@/lib/blogdel";
import { toast } from "sonner";
import { useState } from "react";

const opts = (status?: string, q?: string) => queryOptions({ queryKey: ["admin","articles", status, q], queryFn: () => listAllArticles({ data: { status, q } }) });

export const Route = createFileRoute("/_authenticated/admin/articles/")({
  validateSearch: z.object({ status: z.string().optional(), q: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(opts(deps.status, deps.q)),
  component: ArticlesList,
});

function ArticlesList() {
  const s = Route.useSearch();
  const nav = Route.useNavigate();
  const { data } = useSuspenseQuery(opts(s.status, s.q));
  const qc = useQueryClient();
  const [q, setQ] = useState(s.q ?? "");
  const setStatus = async (id: string, status: any) => {
    try { await updateArticleStatus({ data: { id, status } }); toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin","articles"] }); }
    catch (e: any) { toast.error(e.message); }
  };
  const filters = ["","draft","review","scheduled","published","failed","archived"];

  return (
    <>
      <PageTitle eyebrow="Publishing" title="Articles" description="Every article in every state. Approve reviews, unpublish, archive." />
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); nav({ search: { ...s, q: q || undefined } }); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / keyword…" className="max-w-md" />
        <Button type="submit">Search</Button>
      </form>
      <div className="flex flex-wrap gap-1 mb-4">
        {filters.map(f => (
          <Link key={f} to="/admin/articles" search={{ ...s, status: f || undefined }}
            className={`text-xs px-2 py-1 border border-border ${((s.status ?? "") === f) ? "bg-foreground text-background" : "hover:bg-muted"}`}>
            {f ? STATUS_LABELS[f] : "all"}
          </Link>
        ))}
      </div>
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3">Title</th><th>Category</th><th>Author</th><th>Status</th><th>Published</th><th></th></tr></thead>
          <tbody>
            {data.map((a: any) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3">
                  <Link to="/admin/articles/$id" params={{ id: a.id }} className="hover:text-accent-ink font-medium">{a.title}</Link>
                  <div className="text-xs text-muted-foreground">{a.slug}</div>
                </td>
                <td>{a.categories?.label}</td>
                <td>{a.authors?.display_name}</td>
                <td><Badge variant={a.status === "failed" ? "destructive" : "outline"}>{STATUS_LABELS[a.status] ?? a.status}</Badge></td>
                <td className="text-xs">{a.published_at ? formatDateTime(a.published_at) : "-"}</td>
                <td className="whitespace-nowrap">
                  {a.status === "review" && <Button size="sm" onClick={() => setStatus(a.id, "published")}>Publish</Button>}
                  {a.status === "published" && <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "archived")}>Archive</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <p className="p-6 text-center text-muted-foreground">Nothing matches.</p>}
      </div>
    </>
  );
}
