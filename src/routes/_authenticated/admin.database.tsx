import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { dbStats } from "@/lib/admin.functions";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { Card, CardContent } from "@/components/ui/card";

const opts = queryOptions({ queryKey: ["admin","db"], queryFn: () => dbStats() });

export const Route = createFileRoute("/_authenticated/admin/database")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: DbPage,
});

function DbPage() {
  const { data } = useSuspenseQuery(opts);
  return (
    <>
      <PageTitle eyebrow="Storage" title="Database" description="Row counts and stuck-job detector." />
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(data.counts).map(([t, n]) => (
          <Card key={t}>
            <CardContent className="pt-6">
              <div className="eyebrow">{t}</div>
              <div className="headline text-3xl mt-1">{n}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <div className="eyebrow mb-2">Stuck jobs (running &gt; 30m)</div>
        {data.stuck.length === 0 ? <p className="text-sm text-muted-foreground">None. 👏</p> : (
          <ul className="text-sm">{data.stuck.map((s: any) => <li key={s.id} className="font-mono">{s.id} | started {s.started_at}</li>)}</ul>
        )}
      </div>
    </>
  );
}
