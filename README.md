# Blogdel

> An autonomous editorial desk that does not drink the newsroom coffee.

[Blogdel](https://blogdel.blog) discovers story ideas, delegates them to AI writers, validates every result, and publishes structured articles through a real editorial pipeline. It combines a public publication with an authenticated operations dashboard for sources, jobs, articles, authors, system state, manual generation, and scheduling.

## Links

- **Publication:** [blogdel.blog](https://blogdel.blog)
- **Development deployment:** [blogdel.lovable.app](https://blogdel.lovable.app)
- **Source repository:** [caseytembocodes/editorial-ai](https://github.com/caseytembocodes/editorial-ai/)

Blogdel was created for [OpenAI Build Week](https://openai.com/build-week/), a global challenge to explore what people can bring to life with Codex. The challenge celebrates thoughtful use of GPT‑5.6 and Codex across technical implementation, design and user experience, potential impact, and quality of the idea. Blogdel's answer is simple: do not make AI imitate a text box—give it a newsroom to operate.

## What it does

Blogdel runs an auditable source-to-publication workflow:

```text
configured sources
      ↓
source items
      ↓
delegation jobs
      ↓
AI generation + provider fallbacks
      ↓
Zod validation + reference checks
      ↓
review / schedule / publication
```

- Collects and normalizes ideas from configured editorial sources.
- Creates traceable delegation jobs instead of generating content invisibly.
- Routes generation through **Groq → Gemini**.
- Records provider attempts and failures for operational visibility.
- Validates generated articles with Zod before they enter the catalogue.
- Enforces category-specific reference requirements.
- Supports manual single and batch generation from the admin dashboard.
- Shows the next six scheduled publishing runs.
- Provides role-based admin, editor, and read-only reviewer access.
- Runs scheduled production ticks three times daily in `Africa/Johannesburg`.

## Why it matters

Most AI publishing demos stop when a model returns prose. Blogdel treats that response as the middle of the process, not the finish line. Sources, prompts, provider events, validation, references, jobs, article state, and publication timing remain visible and manageable.

That makes Blogdel less like “generate me a blog post” and more like a compact, observable editorial operating system.

## Built with

- **Codex** for repository-level implementation, debugging, validation, and delivery
- **GPT‑5.6 Sol** for planning, orchestration, codebase review, production diagnosis, and managing Lovable through the ChatGPT connector
- **TanStack Start**, React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
- **Supabase / PostgreSQL** for authentication, roles, editorial data, scheduling, and operational history
- **Zod** for structured article validation
- **Lovable** for hosting and managed application infrastructure
- **Groq and Gemini** as the ordered generation provider chain

## The build team

Blogdel was orchestrated by **Casey Tembo**.

The project was planned with **ChatGPT 5.6 Sol**, developed in and with **Codex**, and hosted by **Lovable**. GPT‑5.6 Sol also acted as a codebase reviewer and production operator: inspecting implementation details, diagnosing provider fallbacks, coordinating GitHub delivery, and managing Lovable through its ChatGPT connector.

In short: Casey called the editorial meeting; the agents brought laptops.

## Local development

```bash
npm install
npm run dev
```

Create a local `.env` with the required Supabase and provider configuration. Secrets must remain outside source control.

For a production check:

```bash
npm run build
```

## Operational notes

- The public cron endpoint accepts only `x-cron-token` and requires `CRON_TOKEN`.
- Provider fallbacks are intentional and should retain their configured order.
- Write operations are protected by authenticated server-side role checks; disabling controls in the reviewer UI is not the security boundary.
- Scheduled requests and secrets belong in Supabase scheduling/Vault or equivalent managed configuration—not in GitHub.

## Status

Built, deployed, scheduled, and submitted with equal parts engineering discipline and deadline energy. 🫡
