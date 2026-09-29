import { z } from "zod";

export const pendingCategoryArchiveEntrySchema = z.object({
  external_id: z.string(),
  category: z.enum(["health", "sports", "politics"]),
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
    neutral_politics: z.boolean().optional(),
    non_diagnostic_health: z.boolean().optional(),
  }),
});

type Category = "health" | "sports" | "politics";
type Entry = z.infer<typeof pendingCategoryArchiveEntrySchema>;

function buildArchive(category: Category, prefix: string, startDate: string, areas: readonly string[], lenses: readonly string[]) {
  const start = new Date(`${startDate}T12:00:00.000Z`).getTime();
  const entries: Entry[] = areas.flatMap((area, areaIndex) =>
    lenses.map((lens, lensIndex) => {
      const index = areaIndex * lenses.length + lensIndex;
      return pendingCategoryArchiveEntrySchema.parse({
        external_id: `${prefix}-archive-2026-${String(index + 1).padStart(3, "0")}`,
        category,
        target_published_at: new Date(start + index * 86_400_000).toISOString(),
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
          ...(category === "politics" ? { neutral_politics: true } : {}),
          ...(category === "health" ? { non_diagnostic_health: true } : {}),
        },
      });
    }),
  );
  if (entries.length !== 245) throw new Error(`${category} archive manifest must contain 245 entries, got ${entries.length}`);
  if (new Set(entries.map((x) => x.target_published_at)).size !== 245 || new Set(entries.map((x) => x.title)).size !== 245) {
    throw new Error(`${category} archive manifest requires 245 unique dates and titles`);
  }
  return entries;
}

const healthAreas = [
  "Sleep and circadian rhythms",
  "Hydration and fluid balance",
  "Balanced nutrition",
  "Vaccination basics",
  "Blood pressure",
  "Blood glucose regulation",
  "Mental health literacy",
  "Maternal health",
  "Child development",
  "Oral health",
  "Physical activity",
  "Musculoskeletal health",
  "Infection prevention",
  "Antibiotic stewardship",
  "Cardiovascular health",
  "Respiratory health",
  "Digestive health",
  "Kidney health",
  "Liver health",
  "Skin health",
  "Eye health",
  "Hearing health",
  "Reproductive health",
  "Sexual health education",
  "Healthy ageing",
  "Preventive screening",
  "First aid principles",
  "Medication safety",
  "Public health surveillance",
  "Environmental health",
  "Occupational health",
  "Health literacy",
  "Primary healthcare systems",
  "Evidence based medicine",
  "Chronic pain management"
] as const;
const healthLenses = [
  "How it works",
  "Why prevention matters",
  "What common misconceptions miss",
  "How risk is assessed",
  "What evidence can and cannot show",
  "How everyday choices affect outcomes",
  "When professional care becomes important"
] as const;
const sportsAreas = [
  "Football tactics",
  "Rugby laws",
  "Cricket bowling",
  "Basketball spacing",
  "Tennis serving",
  "Sprint mechanics",
  "Distance running",
  "Swimming technique",
  "Cycling efficiency",
  "Gymnastics fundamentals",
  "Volleyball systems",
  "Field hockey tactics",
  "Boxing fundamentals",
  "Martial arts training",
  "Motorsport race craft",
  "Golf course management",
  "Endurance training",
  "Strength development",
  "Recovery science",
  "Sports nutrition",
  "Biomechanics",
  "Officiating",
  "Tournament formats",
  "Youth athlete development",
  "Injury prevention",
  "Sports analytics",
  "Scouting and recruitment",
  "Coaching communication",
  "Team culture",
  "Sports psychology",
  "Anti doping systems",
  "Sports governance",
  "Adaptive sports",
  "Venue design",
  "Sports broadcasting"
] as const;
const sportsLenses = [
  "How it works",
  "Why technique matters",
  "Where strategy changes outcomes",
  "How performance is measured",
  "What beginners often misunderstand",
  "How training adapts over time",
  "What rules and safety standards protect"
] as const;
const politicsAreas = [
  "Separation of powers",
  "Legislatures",
  "Executive branches",
  "Judiciaries",
  "Constitutions",
  "Federal and unitary systems",
  "Electoral systems",
  "Political parties",
  "Civil services",
  "Local government",
  "Public budgeting",
  "Taxation and public finance",
  "Policy making",
  "Regulation",
  "Civil rights and liberties",
  "Public participation",
  "Petitions and consultations",
  "Referendums",
  "Legislative oversight",
  "Ombudsman institutions",
  "Public audit institutions",
  "Diplomacy",
  "International organizations",
  "Trade policy",
  "National security institutions",
  "Decentralization",
  "Coalition government",
  "Cabinet government",
  "Legislative committees",
  "Campaign finance rules",
  "Election administration",
  "Electoral district design",
  "Legislative drafting",
  "Judicial review",
  "Constitutional amendment"
] as const;
const politicsLenses = [
  "How it works",
  "Why the institution exists",
  "How different systems approach it",
  "Where checks and balances apply",
  "What common misconceptions miss",
  "How accountability is evaluated",
  "Why implementation details matter"
] as const;

export const pendingHealthArchive = buildArchive("health", "health", "2026-01-27", healthAreas, healthLenses);
export const pendingSportsArchive = buildArchive("sports", "sports", "2026-01-28", sportsAreas, sportsLenses);
export const pendingPoliticsArchive = buildArchive("politics", "politics", "2026-01-28", politicsAreas, politicsLenses);

function work(id: string, category: Category, entries: Entry[], reason: string) {
  return {
    id,
    state: "pending_database" as const,
    reason,
    execution_policy: "Materialize entries into Blogdel production source_items in safe idempotent batches, then generate and publish through Blogdel's article pipeline. Never write them to an unrelated database.",
    expected_count: 245,
    date_start: entries[0].target_published_at,
    date_end: entries[entries.length - 1].target_published_at,
    category,
    entries,
  };
}

export const pendingHealthArchiveWork = work(
  "health-archive-2026-01-27-to-2026-09-28", "health", pendingHealthArchive,
  "Blogdel production database was unavailable to the 23:00 archive run."
);
export const pendingSportsArchiveWork = work(
  "sports-archive-2026-01-28-to-2026-09-29", "sports", pendingSportsArchive,
  "Blogdel production database was unavailable to the 00:00 archive run."
);
export const pendingPoliticsArchiveWork = work(
  "politics-archive-2026-01-28-to-2026-09-29", "politics", pendingPoliticsArchive,
  "Blogdel production database was unavailable to the 01:00 archive run."
);
