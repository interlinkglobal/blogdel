import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/blogdel/SiteShell";

const publisherPrivacy = "https://interlinkgt.online/privacy";
const publisherContact = "https://interlinkgt.online/?mini=false#contact";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [
    { title: "Privacy policy | Blogdel" },
    { name: "description", content: "How Blogdel and its service providers use information, cookies, and advertising technologies." },
  ] }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <SiteShell>
      <article className="prose-article mx-auto max-w-3xl">
        <div className="eyebrow">Privacy</div>
        <h1 className="headline mt-2 text-5xl">Privacy policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: 1 October 2026</p>
        <p className="mt-8">Blogdel is an online publication operated by Interlink Global Technologies. This page describes information handled when you visit Blogdel. The <a className="text-accent-ink underline" href={publisherPrivacy} target="_blank" rel="noreferrer">publisher's privacy policy</a> provides additional information about the organisation and privacy requests.</p>

        <h2 className="headline mt-8 mb-3 text-2xl">Information and technologies used</h2>
        <p>When you visit the site, hosting and infrastructure providers may process standard connection and security information, such as your IP address, browser details, requested pages, and request time. Blogdel uses Supabase to store published articles and related publication data. Authorized staff sign-in uses Supabase authentication. Blogdel does not offer public reader accounts.</p>
        <p>The site saves your display theme choice in your browser's local storage under <code>blogdel-theme</code>. This preference is used to remember light, dark, or system appearance.</p>

        <h2 className="headline mt-8 mb-3 text-2xl">Advertising and cookies</h2>
        <p>Blogdel loads Google AdSense to serve advertisements. Google and its partners may use cookies or similar technologies to store or access information on your browser, measure ad performance, prevent fraud, and select or personalise ads where permitted. Ad selection may use information about this and other sites you visit. Ad availability and personalisation depend on Google's settings and applicable consent requirements.</p>
        <p>Manage Google's use of advertising information at <a className="text-accent-ink underline" href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google Ads Settings</a>. See <a className="text-accent-ink underline" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">how Google uses information from sites or apps that use its services</a>. You can also control cookies in your browser; blocking them may affect site or advertising features.</p>

        <h2 className="headline mt-8 mb-3 text-2xl">Service providers and links</h2>
        <p>Blogdel uses third-party services to host the site, store publication data, display fonts and images, and generate article drafts. Those providers process information as needed to provide their services under their own terms and privacy notices. Links to other sites are governed by those sites' policies.</p>

        <h2 className="headline mt-8 mb-3 text-2xl">Retention and your choices</h2>
        <p>Information is retained for as long as needed to operate and secure the publication, meet legal obligations, and handle requests. You can clear the saved theme preference through your browser settings and manage advertising personalisation through Google's controls.</p>
        <p>For a privacy request or question, use the publisher's <a className="text-accent-ink underline" href={publisherContact} target="_blank" rel="noreferrer">contact form</a>. The publisher's policy explains applicable rights and request handling, including for people in South Africa.</p>

        <h2 className="headline mt-8 mb-3 text-2xl">Changes</h2>
        <p>We may update this policy when site functionality or applicable requirements change. The date above indicates when this page was last revised.</p>
      </article>
    </SiteShell>
  );
}
