import { z } from "zod";

const technologyAreas = [
  "Application programming interfaces",
  "Battery management systems",
  "Browser rendering engines",
  "Cloud object storage",
  "Content delivery networks",
  "Database indexing",
  "Digital identity systems",
  "Edge computing",
  "Federated learning",
  "Fiber optic networks",
  "Geographic information systems",
  "Graphics processing units",
  "Hardware security modules",
  "Internet routing",
  "Large language model inference",
  "Low power wireless networks",
  "Machine learning feature stores",
  "Memory safe programming",
  "Network time synchronization",
  "Open source package ecosystems",
  "Passkey authentication",
  "Privacy preserving computation",
  "Quantum error correction",
  "Real time operating systems",
  "Relational database replication",
  "Satellite internet",
  "Semiconductor fabrication",
  "Software supply chain security",
  "Solid state storage",
  "Spatial computing",
  "Streaming data platforms",
  "Trusted execution environments",
  "Vector databases",
  "Web accessibility",
  "Zero trust network architecture",
] as const;

const technologyLenses = [
  "How it works",
  "Why architecture matters",
  "Where performance bottlenecks emerge",
  "How reliability is engineered",
  "What security changes the design",
  "How standards shape interoperability",
  "What trade offs operators must manage",
] as const;

export const pendingArchiveEntrySchema = z.object({
  external_id: z.string().regex(/^tech-archive-2026-\d{3}$/),
  category: z.literal("technology"),
  target_published_at: z.string().datetime(),
  title: z.string().min(8).max(160),
  source_type: z.literal("evergreen"),
  article_type: z.literal("explainer"),
  target_length: z.number().int().min(300).max(3000),
  status: z.literal("pending_database"),
  image_policy: z.literal("unique-first-fallback-allowed"),
  instructions: z.object({
    substantive: z.literal(true),
    exact_title: z.literal(true),
    no_em_dash: z.literal(true),
    prohibited_icons: z.array(z.string()),
    reference_minimum: z.number().int().min(1),
  }),
});

export type PendingArchiveEntry = z.infer<typeof pendingArchiveEntrySchema>;

function isoDateAtNoonUtc(index: number) {
  const start = Date.UTC(2026, 0, 27, 12, 0, 0);
  return new Date(start + index * 86_400_000).toISOString();
}

export const pendingTechnologyArchive: PendingArchiveEntry[] = technologyAreas.flatMap(
  (area, areaIndex) =>
    technologyLenses.map((lens, lensIndex) => {
      const index = areaIndex * technologyLenses.length + lensIndex;
      return pendingArchiveEntrySchema.parse({
        external_id: `tech-archive-2026-${String(index + 1).padStart(3, "0")}`,
        category: "technology",
        target_published_at: isoDateAtNoonUtc(index),
        title: `${area}: ${lens}`,
        source_type: "evergreen",
        article_type: "explainer",
        target_length: 1000,
        status: "pending_database",
        image_policy: "unique-first-fallback-allowed",
        instructions: {
          substantive: true,
          exact_title: true,
          no_em_dash: true,
          prohibited_icons: ["robot", "star", "sparkle"],
          reference_minimum: 1,
        },
      });
    }),
);

if (pendingTechnologyArchive.length !== 245) {
  throw new Error(`Technology archive manifest must contain 245 entries, got ${pendingTechnologyArchive.length}`);
}

const dates = new Set(pendingTechnologyArchive.map((entry) => entry.target_published_at));
const titles = new Set(pendingTechnologyArchive.map((entry) => entry.title));
if (dates.size !== 245 || titles.size !== 245) {
  throw new Error("Technology archive manifest requires 245 unique dates and titles");
}

export const pendingTechnologyArchiveWork = {
  id: "technology-archive-2026-01-27-to-2026-09-28",
  state: "pending_database" as const,
  reason: "Blogdel production database was unavailable to the 22:00 archive run.",
  execution_policy: "When Blogdel production Supabase is available, materialize these entries through the existing source_items and backfill-technology pipeline in safe batches. Never write them to an unrelated database.",
  expected_count: 245,
  date_start: pendingTechnologyArchive[0].target_published_at,
  date_end: pendingTechnologyArchive[pendingTechnologyArchive.length - 1].target_published_at,
  category: "technology" as const,
  entries: pendingTechnologyArchive,
};
