import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getArticleAdmin, updateArticleContent, updateArticleStatus } from "@/lib/admin.functions";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDateTime, STATUS_LABELS } from "@/lib/blogdel";

const opts = (id: string) => queryOptions({ queryKey: ["admin","article", id], queryFn: () => getArticleAdmin({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/admin/articles/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  component: ArticleAdmin,
});

function ArticleAdmin() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const qc = useQueryClient();
  const a: any = data.article;
  const [title, setTitle] = useState(a?.title ?? "");
  const [desc, setDesc] = useState(a?.description ?? "");
  const [body, setBody] = useState(a?.body_markdown ?? "");
  const [reason, setReason] = useState("");
  useEffect(() => { if (a) { setTitle(a.title); setDesc(a.description); setBody(a.body_markdown); } }, [a?.id]);
  if (!a) return <p>Not found</p>;

  const save = async () => {
    try { await updateArticleContent({ data: { id, title, description: desc, body_markdown: body, change_reason: reason || undefined } });
      toast.success("Saved"); setReason(""); qc.invalidateQueries({ queryKey: ["admin","article", id] }); }
    catch (e: any) { toast.error(e.message); }
  };
  const setStatus = async (status: any) => {
    try { await updateArticleStatus({ data: { id, status } }); toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["admin","article", id] }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <div className="mb-2 text-sm"><Link to="/admin/articles" className="text-muted-foreground hover:text-foreground">← Articles</Link></div>
      <PageTitle eyebrow={a.categories?.label} title={a.title}
        right={<div className="flex gap-2 items-center">
          <Badge variant="outline">{STATUS_LABELS[a.status] ?? a.status}</Badge>
          {a.status === "review" && <Button size="sm" onClick={() => setStatus("published")}>Publish</Button>}
          {a.status === "published" && <Button size="sm" variant="outline" onClick={() => setStatus("archived")}>Archive</Button>}
          {a.status !== "draft" && <Button size="sm" variant="ghost" onClick={() => setStatus("draft")}>To draft</Button>}
        </div>} />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="eyebrow">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="eyebrow">Description</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
          <div>
            <label className="eyebrow">Body markdown</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={22} className="font-mono text-xs" />
          </div>
          <div>
            <label className="eyebrow">Change reason (optional)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Corrected date in lede" />
          </div>
          <Button onClick={save}>Save & version</Button>
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm eyebrow">Provenance</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><span className="text-muted-foreground">Provider:</span> <code>{a.provider}</code></div>
              <div><span className="text-muted-foreground">Model:</span> <code>{a.model}</code></div>
              <div><span className="text-muted-foreground">Words:</span> {a.word_count}</div>
              <div><span className="text-muted-foreground">Reading time:</span> {a.reading_time_minutes}m</div>
              <div><span className="text-muted-foreground">Author:</span> {a.authors?.display_name}</div>
              <div><span className="text-muted-foreground">Published:</span> {a.published_at ? formatDateTime(a.published_at) : "-"}</div>
              {a.is_demo && <Badge variant="outline">Demo</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm eyebrow">References ({data.refs.length})</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              {data.refs.map((r: any) => (
                <div key={r.id}>
                  <a className="text-accent-ink underline" href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
                  <div className="text-xs text-muted-foreground">{r.provider} · {r.authority}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm eyebrow">Versions</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {data.versions.length === 0 && <p className="text-muted-foreground">No versions yet.</p>}
              <ul className="space-y-1">
                {data.versions.map((v: any) => (
                  <li key={v.id} className="text-xs">v{v.version_number} · {formatDateTime(v.created_at)} | {v.change_reason ?? "no reason"}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
