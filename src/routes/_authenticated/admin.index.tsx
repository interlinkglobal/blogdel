import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getOverview } from "@/lib/admin.functions";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, timeAgo, STATUS_LABELS } from "@/lib/blogdel";

const opts = queryOptions({ queryKey: ["admin","overview"], queryFn: () => getOverview() });

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: Overview,
});

function Overview() {
  const { data } = useSuspenseQuery(opts);
  const s: any = data.system;
  return (
    <>
      <PageTitle eyebrow="Operations" title="Newsroom overview" description="Everything the autonomous pipeline has done today." />
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Stat label="Published today" value={`${data.publishedToday} / ${data.target}`} sub="Daily target" />
        <Stat label="Queued jobs" value={data.counts.queued} sub="Awaiting delegation" />
        <Stat label="Running" value={data.counts.running} sub="In flight" />
        <Stat label="Failed" value={data.counts.failed} sub="Need retry" tone={data.counts.failed > 0 ? "warn" : "ok"} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm eyebrow">Pipeline state</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <Row k="Mode"><Badge>{s?.mode ?? "-"}</Badge></Row>
            <Row k="Primary provider"><code className="text-xs">{s?.primary_provider ?? "-"}</code></Row>
            <Row k="Runs at"><span>{s?.morning_hour}:00 · {s?.afternoon_hour}:00 · {s?.night_hour}:00</span></Row>
            <Row k="Daily target"><span>{s?.daily_target} (max {s?.daily_maximum})</span></Row>
            <Row k="Per-category cap"><span>{s?.per_category_max}</span></Row>
            <Row k="Min body length"><span>{s?.min_body_length} chars</span></Row>
            <Row k="Last cron"><span>{s?.last_run_at ? formatDateTime(s.last_run_at) : "never"}</span></Row>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm eyebrow">Article ledger</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {Object.entries(data.articleCounts).map(([k, v]) => (
              <Row key={k} k={STATUS_LABELS[k] ?? k}><span className="font-mono">{v}</span></Row>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader><CardTitle className="text-sm eyebrow">Recent provider events</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {data.recentEvents.length === 0 && <p className="text-muted-foreground">No events yet.</p>}
            <ul className="divide-y divide-border">
              {data.recentEvents.map((e: any) => (
                <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                  <span><code className="text-xs mr-2">{e.provider}</code>{e.event_type}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}{e.status_code ? ` · ${e.status_code}` : ""}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{k}</span>{children}</div>;
}
function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "ok"|"warn" }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="eyebrow">{label}</div>
        <div className={`headline text-3xl mt-1 ${tone === "warn" ? "text-destructive" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
