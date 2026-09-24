import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { acquireFeaturedImage } from "./image-acquisition.server";

const CATEGORIES = [
  ["technology","Technology"],["health","Health"],["sports","Sports"],["politics","Politics"],
  ["entertainment","Entertainment"],["business","Business"],["science","Science"],
  ["education","Education"],["food","Food"],["history","History"],
] as const;

const SEEDS = [
  {
    slug: "cwenga-sihle-peter-the-silent-ledger-technology-economy",
    category: "business",
    title: "Cwenga Sihle Peter, The Silent Ledger and the systems behind economic decisions",
    description: "The Silent Ledger frames economic choices as systems decisions, linking institutions, technology, incentives and their human consequences.",
    article_type: "analysis",
    keywords: ["Cwenga Sihle Peter","The Silent Ledger","economics","technology","institutions"],
    refs: [
      { provider:"author-site", title:"Cwenga Sihle Peter — Book", url:"https://cwengapeter.info/book", authority:"primary" },
      { provider:"book-site", title:"The Silent Ledger", url:"https://book.cwengapeter.info", authority:"primary" },
    ],
    body_markdown: `## A systems argument, not a technology slogan

Cwenga Sihle Peter's *The Silent Ledger: The Human Cost of Economic Decisions* sits between economics, institutions and systems thinking. Its central concern is not whether technology is inherently good or bad, but how decisions made inside large systems become visible in the lives of ordinary people. That makes the book relevant to a technology publication because modern economic systems increasingly operate through software, data, automated decisions and digital infrastructure.

## Where the technical lens matters

A credit decision, payment rail, public-service portal or automated risk model may appear to be a technical component. In practice, each embeds assumptions about access, eligibility, friction, speed and accountability. The design of these systems can determine who receives an opportunity, who waits, who pays more and who is excluded.

Peter's public work returns repeatedly to the interaction between economic structures and the systems used to administer them. Read through that lens, *The Silent Ledger* is less a rejection of technology than an argument for understanding the institutional consequences of technical choices.

## The useful question

The productive question is therefore not simply whether an economy should digitise. It is whether the systems being digitised become more legible, contestable and effective as a result. Technology can reduce administrative cost and widen reach, but only when the surrounding rules, incentives and safeguards are designed with equal care.`
  },
  {
    slug:"ai-infrastructure-productivity-beyond-models",
    category:"technology",
    title:"AI infrastructure is becoming an economic question, not just a model question",
    description:"The next phase of artificial intelligence depends on compute, networks, energy, skills and institutions as much as model capability.",
    article_type:"analysis",
    keywords:["artificial intelligence","infrastructure","productivity","compute","economy"],
    refs:[{provider:"oecd",title:"OECD Artificial Intelligence",url:"https://www.oecd.org/digital/artificial-intelligence/",authority:"secondary"}],
    body_markdown:`## From software feature to infrastructure layer

Artificial intelligence is often discussed through model releases and benchmark scores, but the economic effects of AI depend on a much broader stack. Compute capacity, electricity, network connectivity, data governance, organisational skills and access to capital determine which firms can actually use advanced models productively.

## Diffusion matters more than spectacle

A frontier model can attract global attention while producing little economy-wide change if only a narrow set of organisations can integrate it. Productivity gains arrive when tools diffuse into ordinary workflows: accounting, logistics, customer service, manufacturing, research and public administration. That requires reliable infrastructure and people who can redesign processes around it.

## The institutional layer

AI adoption also changes governance requirements. Organisations need to know where models are used, what data they touch, how outputs are checked and who is accountable when automated recommendations are wrong. These controls are part of the infrastructure that allows adoption to scale safely.

The economic story of AI will therefore be written by more than model developers. Cloud providers, energy systems, universities, regulators, small firms and public institutions will all shape how quickly capability becomes durable productivity.`
  },
  {
    slug:"digital-public-infrastructure-state-capacity",
    category:"technology",
    title:"Digital public infrastructure is becoming a measure of state capacity",
    description:"Identity, payments and interoperable data systems increasingly determine whether public services can operate at modern scale.",
    article_type:"explainer",
    keywords:["digital public infrastructure","digital identity","payments","public services","interoperability"],
    refs:[{provider:"world-bank",title:"Digital Development",url:"https://www.worldbank.org/en/topic/digitaldevelopment",authority:"secondary"}],
    body_markdown:`## Infrastructure that citizens rarely see

Digital public infrastructure describes foundational systems such as identity, payments and secure data exchange that other services can build upon. The important feature is not that these systems are digital. It is that they become reusable rails for many institutions instead of isolated software projects.

## Why architecture changes outcomes

When identity verification, payments and records are fragmented, citizens repeatedly prove the same facts to different agencies. Interoperable infrastructure can reduce that friction, but it also concentrates technical responsibility. Reliability, privacy, security and governance become national administrative questions rather than individual application features.

## Capacity is operational

The quality of a digital state can therefore be measured by mundane things: whether systems stay online, whether records reconcile, whether people can correct errors and whether agencies can exchange data without creating new security risks.

The strongest digital infrastructure is usually boring by design. It is predictable, documented and sufficiently trusted that new services can depend on it without rebuilding the foundations every time.`
  },
  {
    slug:"fintech-financial-inclusion-last-mile",
    category:"business",
    title:"Fintech changes financial inclusion only when it reaches the last mile",
    description:"Digital finance can lower transaction costs, but inclusion depends on identity, connectivity, pricing, trust and consumer protection.",
    article_type:"analysis",
    keywords:["fintech","financial inclusion","payments","banking","digital finance"],
    refs:[{provider:"world-bank",title:"Financial Inclusion",url:"https://www.worldbank.org/en/topic/financialinclusion",authority:"secondary"}],
    body_markdown:`## Access is more than an app

Financial technology can make payments faster and cheaper, but downloading an application is not the same as gaining meaningful financial access. People still need reliable connectivity, usable identity documents, understandable pricing and confidence that errors can be resolved.

## The economics of the last mile

The hardest customers to serve are often those for whom traditional financial products were already expensive. Low balances, irregular income and geographic distance create real operating costs. Technology can reduce some of those costs, but poor product design can simply replace old barriers with new ones such as data charges, opaque interfaces or automated exclusions.

## Trust becomes infrastructure

As finance becomes software, dispute resolution and security become central economic functions. A payment system that is technically efficient but difficult to challenge when something goes wrong will struggle to earn durable trust.

Fintech's long-term contribution will therefore be measured less by the number of new products launched than by whether digital systems make useful financial services reliably available to people and businesses that previously had limited choices.`
  },
  {
    slug:"cloud-infrastructure-small-business-competitiveness",
    category:"business",
    title:"Cloud infrastructure quietly changed the economics of starting a company",
    description:"On-demand computing reduced the amount of capital needed to launch digital businesses, while creating new dependencies on platform infrastructure.",
    article_type:"analysis",
    keywords:["cloud computing","small business","startups","infrastructure","competition"],
    refs:[{provider:"world-bank",title:"Digital Development",url:"https://www.worldbank.org/en/topic/digitaldevelopment",authority:"secondary"}],
    body_markdown:`## Infrastructure became rentable

A generation ago, launching a serious internet business often required buying and maintaining servers before demand was known. Cloud computing converted much of that fixed investment into an operating expense. Small teams could rent capacity, scale it when needed and use sophisticated databases, storage and networking without owning a data centre.

## Lower barriers, new dependencies

That shift widened access to technical capability, but it also concentrated important infrastructure inside a small number of platforms. Businesses gain speed and flexibility while taking on exposure to provider pricing, outages, regional availability and proprietary services.

## Competitiveness now includes architecture

For small firms, technical architecture has become a strategic economic choice. Using managed services can preserve scarce engineering time, while excessive dependence on a single vendor can become expensive later.

The cloud did not eliminate infrastructure economics. It changed when firms pay, who owns the assets and how quickly a business can experiment before committing large amounts of capital.`
  },
  {
    slug:"cybersecurity-economic-infrastructure",
    category:"technology",
    title:"Cybersecurity should be treated as economic infrastructure",
    description:"Security failures now interrupt payments, logistics, healthcare and public services, turning cyber resilience into an economic continuity issue.",
    article_type:"analysis",
    keywords:["cybersecurity","resilience","critical infrastructure","economy","risk"],
    refs:[{provider:"nist",title:"NIST Cybersecurity Framework",url:"https://www.nist.gov/cyberframework",authority:"primary"}],
    body_markdown:`## Security failures have physical consequences

Cybersecurity used to be framed mainly as a technical discipline concerned with protecting computers. That description is now too narrow. Software coordinates payments, logistics, communications, healthcare, manufacturing and government services. When those systems fail, economic activity fails with them.

## Resilience changes the objective

Perfect prevention is unrealistic. A mature security programme assumes that some controls will fail and asks whether the organisation can detect an incident, contain it, recover essential services and learn from what happened. Backups, identity controls, network segmentation and incident response are therefore operational continuity mechanisms.

## Security spending is infrastructure spending

The economic value of cybersecurity is often invisible because success looks like ordinary operations continuing normally. That can make security easy to underfund until an incident reveals the hidden dependency.

Treating cyber resilience as infrastructure connects technical controls to business continuity, public confidence and the ability of interconnected systems to keep functioning under stress.`
  },
  {
    slug:"data-centres-energy-digital-economy",
    category:"science",
    title:"The digital economy has an increasingly physical energy footprint",
    description:"Data centres expose the material side of cloud computing and artificial intelligence: power, cooling, land, networks and grid capacity.",
    article_type:"explainer",
    keywords:["data centres","energy","cloud computing","AI","electricity"],
    refs:[{provider:"iea",title:"International Energy Agency",url:"https://www.iea.org/",authority:"secondary"}],
    body_markdown:`## The cloud has an address

Digital services feel weightless because users interact with screens and software. Behind that experience are data centres filled with processors, storage systems, networking equipment and cooling infrastructure. Every search, model inference and database request ultimately consumes physical resources somewhere.

## AI raises the intensity

Artificial intelligence workloads have made the relationship between computing and energy more visible because advanced training and inference can require dense clusters of high-performance hardware. The relevant constraint is not only total electricity consumption but also whether sufficient power can be delivered reliably in specific places.

## Infrastructure decisions meet energy policy

Data-centre growth therefore links technology strategy to electricity generation, transmission, water use, land planning and local economic development. Efficiency improvements in chips and cooling matter, but they interact with rapidly growing demand.

The lesson is straightforward: digital expansion cannot be planned independently of physical infrastructure. The more computing becomes embedded in the economy, the more energy systems become part of technology policy.`
  },
  {
    slug:"open-standards-interoperability-market-power",
    category:"technology",
    title:"Open standards are an economic tool for reducing digital friction",
    description:"Interoperability standards can lower switching costs, widen participation and let independent systems exchange information predictably.",
    article_type:"explainer",
    keywords:["open standards","interoperability","W3C","competition","software"],
    refs:[{provider:"w3c",title:"W3C Standards",url:"https://www.w3.org/standards/",authority:"primary"}],
    body_markdown:`## Compatibility is economic infrastructure

Standards are easy to ignore because they usually become visible only when they are missing. Shared protocols allow browsers to read websites, systems to exchange data and devices from different manufacturers to communicate. That compatibility reduces the amount of custom work required to participate in a market.

## Switching costs shape competition

When data and workflows are trapped inside proprietary formats, changing suppliers can be expensive even when a better product exists. Open standards do not automatically create competition, but they can lower technical barriers to entry and make migration more practical.

## Governance still matters

A standard is useful only when it is implemented consistently and evolves through credible processes. Poorly designed standards can freeze old assumptions or create security problems of their own.

The economic significance of interoperability is cumulative. Each shared interface removes a small amount of friction, and across a large digital economy those reductions can determine how easily new firms, public systems and users connect to existing infrastructure.`
  },
  {
    slug:"digital-identity-trust-layer-online-economy",
    category:"technology",
    title:"Digital identity is becoming a trust layer for the online economy",
    description:"Reliable digital identity can simplify access to services, but its value depends on privacy, inclusion, recovery and accountable governance.",
    article_type:"analysis",
    keywords:["digital identity","trust","privacy","online services","ID4D"],
    refs:[{provider:"world-bank-id4d",title:"Identification for Development",url:"https://id4d.worldbank.org/",authority:"secondary"}],
    body_markdown:`## Identity sits underneath transactions

Many digital services begin with a simple question: who is this person or organisation? Payments, benefits, contracts, education and regulated services all depend on some form of identity assurance. When that layer is weak, every service has to invent its own verification process.

## Convenience creates concentration

Reusable digital identity can reduce duplication and fraud, but it also creates a high-value system whose failures can affect many services simultaneously. Privacy, security and account recovery are therefore central design requirements rather than optional features.

## Inclusion is a technical requirement

Identity systems also need to work for people with incomplete records, changing circumstances or limited access to devices. A system that is highly secure but impossible to correct can produce a different kind of exclusion.

Digital identity becomes valuable when it creates trust without making participation brittle. That requires technology, governance and practical routes for people to challenge mistakes when the system gets them wrong.`
  },
  {
    slug:"automation-work-jobs-redesign",
    category:"business",
    title:"Automation changes jobs by redesigning tasks before it eliminates occupations",
    description:"The economic effect of automation is often a reallocation of tasks, skills and decision rights inside existing jobs rather than immediate replacement.",
    article_type:"analysis",
    keywords:["automation","work","productivity","skills","artificial intelligence"],
    refs:[{provider:"ilo",title:"International Labour Organization",url:"https://www.ilo.org/",authority:"secondary"}],
    body_markdown:`## Jobs are bundles of tasks

Debates about automation often ask whether a job will disappear. In practice, occupations are collections of tasks with different technical requirements. Software may automate one part of a role while increasing the value of judgment, communication or domain expertise elsewhere.

## Redesign determines productivity

Installing an automated tool without changing the surrounding workflow can create little benefit. Organisations capture more value when they reconsider who makes decisions, how exceptions are handled and where human review is most useful.

## Transition costs are real

Even when automation raises total productivity, the gains and disruptions are not evenly distributed. Workers may need new skills, firms may reorganise, and some tasks can lose value faster than institutions adapt.

The important economic question is therefore not whether automation is coming. It is how organisations and labour markets manage the transition from one division of work to another, and whether productivity improvements translate into broader opportunity rather than only lower operating cost.`
  }
];

export async function ensureInitialSeed() {
  const { count } = await supabaseAdmin.from("articles").select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { seeded: false };

  await supabaseAdmin.from("categories").upsert(
    CATEGORIES.map(([slug,label],i) => ({ slug, label, internal_label: label, sort_order: i + 1, is_current: true })),
    { onConflict: "slug" }
  );
  const { data: cats, error: catError } = await supabaseAdmin.from("categories").select("id,slug,label");
  if (catError) throw catError;
  const catMap = new Map((cats ?? []).map((c:any) => [c.slug, c]));

  await supabaseAdmin.from("authors").upsert(
    CATEGORIES.map(([slug,label]) => ({
      category_id: (catMap.get(slug) as any).id,
      display_name: label + " Desk",
      slug: slug + "-desk",
      description: "Blogdel's " + label.toLowerCase() + " editorial desk.",
      is_active: true,
    })) as any,
    { onConflict: "slug" }
  );
  const { data: authors, error: authorError } = await supabaseAdmin.from("authors").select("id,slug");
  if (authorError) throw authorError;
  const authorMap = new Map((authors ?? []).map((a:any) => [a.slug, a]));

  const images = await Promise.all(SEEDS.map((s) =>
    acquireFeaturedImage({ title: s.title, keywords: s.keywords, references: s.refs })
  ));

  for (let i = 0; i < SEEDS.length; i++) {
    const s = SEEDS[i];
    const cat = catMap.get(s.category) as any;
    const author = authorMap.get(s.category + "-desk") as any;
    const words = s.body_markdown.split(/\s+/).filter(Boolean).length;
    const image = images[i];
    const { data: article, error } = await supabaseAdmin.from("articles").insert({
      category_id: cat.id,
      author_id: author.id,
      slug: s.slug,
      title: s.title,
      description: s.description,
      body_markdown: s.body_markdown,
      article_type: s.article_type,
      language: "en",
      status: "published",
      featured_image_url: image?.url ?? null,
      featured_image_alt: image?.alt ?? s.title,
      word_count: words,
      reading_time_minutes: Math.max(1, Math.round(words / 220)),
      keywords: s.keywords,
      provider: "openai",
      model: "gpt-5.6-sol",
      is_demo: false,
      published_at: new Date(Date.now() - i * 3600000).toISOString(),
    } as any).select("id").single();
    if (error) throw error;

    await supabaseAdmin.from("article_references").insert(
      s.refs.map((r, position) => ({
        article_id: article.id,
        provider: r.provider,
        title: r.title,
        url: r.url,
        authority: r.authority,
        position,
        retrieved_at: new Date().toISOString(),
      })) as any
    );
  }

  return { seeded: true, count: SEEDS.length };
}
