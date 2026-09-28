import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { foodImageUrl } from "@/lib/food-image-library";
import { ONE_MORE_BITE_URL, RECIPE_SEEDS, type RecipeSeed } from "@/lib/recipe-seeds";

const RECIPE_KEYWORD = "food-recipes";
const RECIPE_PROVIDER = "blogdel-recipe-desk";
const RECIPE_MODEL = "one-more-bite-adaptation-v1";
const RECIPE_DATE_START = Date.UTC(2026, 0, 26, 12, 0, 0);

function publishedAtForRecipe(index: number) {
  return new Date(RECIPE_DATE_START + (index - 1) * 86400000).toISOString();
}

function cleanDishTitle(value: string) {
  return value
    .replace(/^(Restaurant-plated|Freshly plated|Freshly Plated|Beautifully plated|beautifully plated|Sunlit|Artfully plated|Richly plated|Appetizing)\s+/i, "")
    .replace(/,?\s+Freshly Plated$/i, "")
    .replace(/,?\s+beautifully plated$/i, "")
    .replace(/\s+in Natural Light$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 92);
}

function inferRegion(seed: RecipeSeed) {
  if (seed.region !== "World") return seed.region;
  const value = seed.title.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/cape malay|durban|karoo|south african|soweto|zulu|xhosa|boere|braai|bunny chow|malva/, "South Africa"],
    [/moroccan/, "Morocco"],
    [/mozambican/, "Mozambique"],
    [/nigerian/, "Nigeria"],
    [/ghanaian/, "Ghana"],
    [/ethiopian/, "Ethiopia"],
    [/kenyan/, "Kenya"],
    [/tanzanian|zanzibar/, "Tanzania"],
    [/ugandan/, "Uganda"],
    [/zimbabwean/, "Zimbabwe"],
    [/zambian/, "Zambia"],
    [/malawian/, "Malawi"],
    [/namibian/, "Namibia"],
    [/botswana/, "Botswana"],
    [/rwandan/, "Rwanda"],
    [/cameroonian/, "Cameroon"],
    [/egyptian/, "Egypt"],
    [/tunisian/, "Tunisia"],
    [/senegalese|senegal/, "Senegal"],
    [/japanese/, "Japan"],
    [/korean/, "Korea"],
    [/thai/, "Thailand"],
    [/vietnamese/, "Vietnam"],
    [/indian/, "India"],
    [/italian/, "Italy"],
    [/spanish/, "Spain"],
    [/french/, "France"],
    [/mexican/, "Mexico"],
    [/peruvian/, "Peru"],
    [/brazilian/, "Brazil"],
    [/portuguese/, "Portugal"],
    [/afghan/, "Afghanistan"],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? "World";
}

function methodFor(summary: string, title: string) {
  const value = `${summary} ${title}`.toLowerCase();
  if (/fried|fritter|tempura|crisp|fry/.test(value)) return "Keep the frying medium at a steady temperature and work in small batches so the exterior crisps before the centre becomes heavy.";
  if (/grill|braai|charcoal|skewer|roast/.test(value)) return "Build flavour over controlled direct heat, turn deliberately, and let browning develop without drying out the main ingredient.";
  if (/stew|simmer|slow-cooked|braised|curry|soup/.test(value)) return "Develop the aromatic base first, then simmer patiently so the sauce, broth, meat, legumes, or vegetables have time to become one coherent dish.";
  if (/baked|bake|pie|pudding|cake|pastry|bread|tart/.test(value)) return "Treat temperature and texture as the anchors: prepare the mixture or dough evenly, bake until the centre is set, and give the finished dish time to rest before serving.";
  if (/steam|steamed|dumpling|mantu|tamale/.test(value)) return "Prepare the filling or batter before assembly, seal or portion consistently, and use gentle steam or moist heat so the structure cooks without breaking.";
  if (/salad|ceviche|cold|fresh/.test(value)) return "Keep the components fresh and distinct, season close to serving, and balance acidity, salt, heat, and texture rather than overworking the ingredients.";
  if (/rice|pilaf|jollof|biryani/.test(value)) return "Build the seasoned cooking liquid first, add the rice with measured moisture, and finish gently so the grains absorb flavour without losing their structure.";
  if (/pancake|crepe|flatbread|roti|dosa/.test(value)) return "Mix the batter or dough until cohesive, allow any resting or fermentation the style needs, then cook on a well-heated surface in consistent portions.";
  return "Prepare the core components separately where texture matters, then combine them in the order that best preserves contrast, seasoning, and the dish's defining character.";
}

function servingFor(summary: string, title: string) {
  const value = `${summary} ${title}`.toLowerCase();
  if (/stew|curry|soup|relish|sauce/.test(value)) return "Serve it hot, with the starch, bread, rice, or accompaniment traditionally associated with the dish where practical.";
  if (/bread|flatbread|roti|dosa|pancake/.test(value)) return "Serve warm, ideally soon after cooking, with the fillings, sauces, or accompaniments that give the dish its full contrast.";
  if (/dessert|pudding|cake|tart|biscuit|sweet|halwa|xalwo/.test(value)) return "Serve at the temperature that best suits the texture, and keep garnishes restrained so the core flavour remains obvious.";
  return "Serve promptly and keep garnishes purposeful. The finished plate should make the central ingredient and technique immediately clear.";
}

export function buildRecipeBody(seed: RecipeSeed) {
  const dish = cleanDishTitle(seed.title);
  const region = inferRegion(seed);
  const summary = seed.summary.replace(/\s+/g, " ").trim();

  return `## Why this dish belongs in Blogdel Recipes

${dish} is part of the One More Bite food collection and sits here as a Blogdel recipe guide for readers who want more than a picture and a name. ${summary}

The dish is associated here with ${region}. Recipes can change across households, regions, seasons, and available ingredients, so this guide focuses on the defining idea rather than pretending there is only one canonical formula.

## The recipe direction

Start with the character of the dish itself: ${summary.replace(/^[A-Z]/, (c) => c.toLowerCase())} Keep that identity intact when choosing ingredients or substitutions. Use fresh ingredients, season in stages, and avoid adding complexity that hides the technique the dish is known for.

### Method in brief

1. Prepare the main ingredients and aromatics before cooking so the process does not become rushed.
2. ${methodFor(summary, dish)}
3. Taste before the final seasoning, then adjust salt, acidity, heat, sweetness, or richness according to the style of the dish.
4. Rest the food where the technique benefits from it, then finish with only the garnishes or accompaniments that support the main flavour.

## Serving it well

${servingFor(summary, dish)}

## The Blogdel kitchen note

One More Bite approaches food as discovery: understand what makes a dish distinctive, then seek out the version that teaches you something about where it comes from. Blogdel keeps that spirit but adds a little more editorial context around the cooking. This is a practical starting point rather than a tested formula with fixed gram measurements. For traditional preparation, ingredient safety, or culturally specific technique, follow the source trail below and compare more than one trusted local recipe before cooking.`;
}

export async function ensureRecipeSeed() {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("articles")
    .select("slug,published_at")
    .contains("keywords", [RECIPE_KEYWORD]);
  if (existingError) throw existingError;

  const existingSlugs = new Set((existing ?? []).map((row: any) => row.slug));
  const existingBySlug = new Map((existing ?? []).map((row: any) => [row.slug, row]));

  const dateUpdates = RECIPE_SEEDS.flatMap((seed) => {
    const dish = cleanDishTitle(seed.title);
    const slug = `recipe-${String(seed.index).padStart(3, "0")}-${slugify(dish)}`;
    const current = existingBySlug.get(slug) as any;
    const expected = publishedAtForRecipe(seed.index);
    if (!current || current.published_at === expected) return [];
    return [{ slug, published_at: expected }];
  });

  for (let i = 0; i < dateUpdates.length; i += 20) {
    const batch = dateUpdates.slice(i, i + 20);
    const results = await Promise.all(batch.map((row) =>
      supabaseAdmin.from("articles").update({ published_at: row.published_at }).eq("slug", row.slug)
    ));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  }

  if (existingSlugs.size >= RECIPE_SEEDS.length) {
    return { seeded: false, count: existingSlugs.size, datesUpdated: dateUpdates.length };
  }

  const [{ data: category, error: categoryError }, { data: author, error: authorError }] = await Promise.all([
    supabaseAdmin.from("categories").select("id").eq("slug", "food").single(),
    supabaseAdmin.from("authors").select("id").eq("slug", "food-desk").single(),
  ]);
  if (categoryError) throw categoryError;
  if (authorError) throw authorError;

  const missing = RECIPE_SEEDS.filter((seed) => {
    const dish = cleanDishTitle(seed.title);
    return !existingSlugs.has(`recipe-${String(seed.index).padStart(3, "0")}-${slugify(dish)}`);
  });

  const rows = missing.map((seed) => {
    const dish = cleanDishTitle(seed.title);
    const region = inferRegion(seed);
    const body = buildRecipeBody(seed);
    const words = body.split(/\s+/).filter(Boolean).length;
    return {
      category_id: category.id,
      author_id: author.id,
      slug: `recipe-${String(seed.index).padStart(3, "0")}-${slugify(dish)}`,
      title: `${dish}: a Blogdel recipe guide`.slice(0, 160),
      description: `${seed.summary} Blogdel adds practical cooking direction, context, and a path back to the source.`.slice(0, 320),
      body_markdown: body,
      article_type: "guide" as const,
      language: "en",
      status: "published" as const,
      featured_image_url: foodImageUrl(seed.fileId),
      featured_image_alt: `${dish} recipe`,
      word_count: words,
      reading_time_minutes: Math.max(2, Math.round(words / 220)),
      keywords: ["recipe", RECIPE_KEYWORD, "one-more-bite", region.toLowerCase()],
      provider: RECIPE_PROVIDER,
      model: RECIPE_MODEL,
      is_demo: false,
      published_at: publishedAtForRecipe(seed.index),
    };
  });

  const inserted: Array<{ id: string; slug: string }> = [];
  for (let i = 0; i < rows.length; i += 50) {
    const { data, error } = await supabaseAdmin
      .from("articles")
      .insert(rows.slice(i, i + 50) as any)
      .select("id,slug");
    if (error) throw error;
    inserted.push(...((data ?? []) as any));
  }

  const bySlug = new Map(inserted.map((row) => [row.slug, row.id]));
  const refs: any[] = [];
  for (const seed of missing) {
    const dish = cleanDishTitle(seed.title);
    const slug = `recipe-${String(seed.index).padStart(3, "0")}-${slugify(dish)}`;
    const articleId = bySlug.get(slug);
    if (!articleId) continue;

    refs.push({
      article_id: articleId,
      provider: "one-more-bite",
      title: "One More Bite",
      url: ONE_MORE_BITE_URL,
      authority: "primary",
      position: 0,
      retrieved_at: new Date().toISOString(),
    });

    if (seed.sourceUrl && seed.sourceUrl !== ONE_MORE_BITE_URL) {
      refs.push({
        article_id: articleId,
        provider: "recipe-source-trail",
        title: seed.sourceTitle,
        url: seed.sourceUrl,
        authority: "secondary",
        position: 1,
        retrieved_at: new Date().toISOString(),
      });
    }
  }

  for (let i = 0; i < refs.length; i += 100) {
    const { error } = await supabaseAdmin.from("article_references").insert(refs.slice(i, i + 100) as any);
    if (error) throw error;
  }

  return { seeded: true, count: inserted.length };
}
