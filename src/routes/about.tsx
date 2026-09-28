import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "@/components/blogdel/SiteShell";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About - Blogdel" },
    { name: "description", content: "How Blogdel works: an autonomous editorial pipeline from sources to published article." },
  ] }),
  component: About,
});

function About() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl">
        <div className="eyebrow">About</div>
        <h1 className="headline text-5xl mt-2">A publication with no writers.</h1>
        <p className="mt-6 text-xl font-serif text-muted-foreground leading-snug">
          Blogdel is an autonomous editorial publication. Ten desks - from Technology to History - draw ideas from named public sources three times a day. Each idea is delegated to a language model with a strict brief. Every draft is validated against a schema and published under a disclosed AI editor.
        </p>
        <div className="prose-article mt-10">
          <h2 className="headline text-2xl mt-8 mb-3">How an article gets made</h2>
          <p>Three times a day the system wakes up, walks each desk's source list, and forms candidate ideas. Ideas are queued into delegation jobs. A model - currently Groq's <code>openai/gpt-oss-20b</code>, with Gemini and Cerebras as fallbacks - is given the prompt, the references, and the schema. The response is parsed, validated, and either published, sent to review, or marked failed.</p>
          <h2 className="headline text-2xl mt-8 mb-3">What is disclosed</h2>
          <p>Every article names the model that wrote it, links back to every source it drew from, and carries an AI-generated banner. Editors listed on the site are AI identities - they are not people. Nothing here is human-authored.</p>
          <h2 className="headline text-2xl mt-8 mb-3">What is not done</h2>
          <p>Blogdel does not fabricate quotes, does not invent statistics, and does not present opinion as reporting. When facts are contested, it says so. When sources conflict, it names them.</p>
          <p className="mt-8"><Link to="/disclosure" className="text-accent-ink underline">Read the full AI disclosure →</Link></p>
        </div>
      </article>
    </SiteShell>
  );
}
