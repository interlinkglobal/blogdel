import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getJob } from "@/lib/admin.functions";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/blogdel";

const opts = (id: string) => queryOptions({ queryKey: ["admin","job", id], queryFn: () => getJob({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/admin/jobs/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.id)),
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  const j: any = data.job;
  if (!j) return <p>Not found</p>;
  return (
    <>
      <div className="mb-2 text-sm"><Link to="/admin/jobs" className="text-muted-foreground hover:text-foreground">← Jobs</Link></div>
      <PageTitle eyebrow="Job" title={j.job_type + " · " + j.provider + "/" + j.model}
        description={`Created ${formatDateTime(j.created_at)}`}
        right={<Badge variant={j.status === "failed" ? "destructive" : "default"}>{j.status}</Badge>} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm eyebrow">Meta</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <Row k="Category">{j.categories?.label}</Row>
            <Row k="Author">{j.authors?.display_name}</Row>
            <Row k="Attempts">{j.attempt_count}</Row>
            <Row k="Started">{j.started_at ? formatDateTime(j.started_at) : "-"}</Row>
            <Row k="Completed">{j.completed_at ? formatDateTime(j.completed_at) : "-"}</Row>
            {j.failure_reason && <div className="mt-2 text-destructive text-xs whitespace-pre-wrap font-mono">{j.failure_reason}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm eyebrow">Provider events</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {data.events.length === 0 && <p className="text-muted-foreground">No events.</p>}
            <ul className="divide-y divide-border">
              {data.events.map((e: any) => (
                <li key={e.id} className="py-2">
                  <div className="flex justify-between text-xs">
                    <span><code>{e.provider}</code> · {e.event_type}</span>
                    <span className="text-muted-foreground">{formatDateTime(e.created_at)}</span>
                  </div>
                  {e.latency_ms != null && <div className="text-xs text-muted-foreground">latency {e.latency_ms}ms · tokens in {e.input_tokens ?? 0} / out {e.output_tokens ?? 0}</div>}
                  {e.error_code && <div className="text-xs text-destructive">{e.error_code}</div>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader><CardTitle className="text-sm eyebrow">Input payload</CardTitle></CardHeader>
        <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96">{JSON.stringify(j.input_payload, null, 2)}</pre></CardContent>
      </Card>
      {j.output_payload && (
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-sm eyebrow">Output payload</CardTitle></CardHeader>
          <CardContent><pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96">{JSON.stringify(j.output_payload, null, 2)}</pre></CardContent>
        </Card>
      )}
    </>
  );
}
function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{k}</span><span>{children}</span></div>;
}
