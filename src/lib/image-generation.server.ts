import { acquireFeaturedImage } from "@/lib/image-acquisition.server";

export type FeaturedImage = {
  url: string; alt: string;
  sourceType: "generated" | "external" | "category-fallback";
  provider: string | null; model: string | null;
};

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const BUCKET = "article-images";

function promptFor(input: { title: string; category: string; body: string }) {
  const excerpt = input.body.replace(/[#*_\[\]()>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 900);
  return [
    "Realistic 16:9 editorial news photograph, documentary photography, natural lighting, credible real-world details.",
    `Category: ${input.category}. Article: ${input.title}.`, `Context: ${excerpt}`,
    "Compose a strong editorial image that communicates the subject without sensationalism.",
    "No text, no letters, no captions, no watermark, no logos, no brand marks, no fake UI, no interface elements."
  ].join(" ");
}

async function generated(input: { title: string; category: string; body: string; articleId: string }, sb: any): Promise<FeaturedImage | null> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_API_TOKEN;
  if (!accountId || !token) return null;
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ prompt: promptFor(input), width: 1344, height: 768, num_steps: 4 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Cloudflare image generation failed: ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    let bytes: Uint8Array;
    let mime = "image/png";
    if (contentType.startsWith("image/")) {
      mime = contentType.split(";")[0];
      bytes = new Uint8Array(await response.arrayBuffer());
    } else {
      const payload = await response.json() as any;
      const b64 = payload?.result?.image ?? payload?.result?.data?.[0]?.b64_json;
      if (!b64) throw new Error("Cloudflare image response did not contain image data");
      bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    }
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    const path = `generated/${input.category}/${input.articleId}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
    if (error) throw error;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, alt: `Realistic editorial image for ${input.title}`, sourceType: "generated", provider: "cloudflare-workers-ai", model: MODEL };
  } catch (error) {
    console.error("[image-generation]", error);
    return null;
  }
}

export async function resolveFeaturedImage(input: {
  title: string; category: string; body: string; articleId: string;
  keywords?: string[] | null; references?: Array<{ url: string; title?: string | null }> | null;
}, sb: any): Promise<FeaturedImage | null> {
  const ai = await generated(input, sb);
  if (ai) return ai;
  const acquired = await acquireFeaturedImage({ title: input.title, keywords: input.keywords, references: input.references });
  if (acquired) return { url: acquired.url, alt: acquired.alt, sourceType: "external", provider: acquired.source, model: null };
  return { url: `/fallback-images/${input.category}-1.jpg`, alt: `Editorial fallback for ${input.title}`, sourceType: "category-fallback", provider: "blogdel", model: null };
}
