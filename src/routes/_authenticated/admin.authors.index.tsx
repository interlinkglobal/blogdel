import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { listAuthorsAdmin, updateAuthor } from "@/lib/admin.functions";
import { PageTitle } from "@/components/blogdel/AdminShell";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const opts = queryOptions({ queryKey: ["admin","authors"], queryFn: () => listAuthorsAdmin() });

export const Route = createFileRoute("/_authenticated/admin/authors/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: Authors,
});

function Authors() {
  const { data } = useSuspenseQuery(opts);
  const qc = useQueryClient();
  const toggle = async (id: string, is_active: boolean) => {
    try { await updateAuthor({ data: { id, is_active } }); toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin","authors"] }); }
    catch (e: any) { toast.error(e.message); }
  };
  // Group by category
  const byCat: Record<string, any[]> = {};
  for (const a of data) {
    const k = a.categories?.label ?? "-";
    (byCat[k] ??= []).push(a);
  }
  return (
    <>
      <PageTitle eyebrow="Voices" title="AI editors" description="Ten voices per desk. Toggle active to rotate them in and out." />
      <div className="space-y-6">
        {Object.entries(byCat).map(([cat, list]) => (
          <div key={cat}>
            <div className="border-b-2 border-foreground pb-1 mb-2"><h2 className="eyebrow">{cat}</h2></div>
            <div className="grid gap-2 md:grid-cols-2">
              {list.map((a) => (
                <div key={a.id} className="flex items-start justify-between border border-border rounded p-3">
                  <div>
                    <Link to="/admin/authors/$id" params={{ id: a.id }} className="font-medium hover:text-accent-ink">{a.display_name}</Link>
                    <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">{a.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">{a.article_count} articles · weight {a.rotation_weight}</div>
                  </div>
                  <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a.id, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
