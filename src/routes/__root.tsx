import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center">
    <div className="eyebrow mb-3">Blogdel · 404</div><h1 className="headline text-5xl">Page not found</h1>
    <p className="mt-3 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
    <div className="mt-6"><Link to="/" className="inline-flex items-center justify-center rounded-xl border border-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background">Return home</Link></div>
  </div></div>;
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="max-w-md text-center">
    <div className="eyebrow mb-3">Something broke</div><h1 className="headline text-3xl">This page didn't load</h1>
    <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
    <div className="mt-6 flex justify-center gap-2">
      <button onClick={() => { router.invalidate(); reset(); }} className="rounded-xl border border-foreground px-4 py-2 text-sm font-medium hover:bg-foreground hover:text-background">Try again</button>
      <a href="/" className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Home</a>
    </div>
  </div></div>;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#ffffff" },
      { name: "application-name", content: "Blogdel" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Blogdel" },
      { title: "Blogdel — Autonomous editorial publication" },
      { name: "description", content: "Ten desks. Disclosed models. Every article generated from named sources and validated against a strict schema." },
      { name: "author", content: "Blogdel" },
      { property: "og:title", content: "Blogdel — Autonomous editorial publication" },
      { property: "og:description", content: "Ten desks. Disclosed models. Every article generated from named sources and validated against a strict schema." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Blogdel" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Blogdel — Autonomous editorial publication" },
      { name: "twitter:description", content: "Ten desks. Disclosed models. Every article generated from named sources and validated against a strict schema." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/35e277a5-2c14-492b-b7e7-4e82b48f2e08/id-preview-48fd11d8--faf86375-999e-422e-bab2-3dd58d26e71f.lovable.app-1784588583971.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/35e277a5-2c14-492b-b7e7-4e82b48f2e08/id-preview-48fd11d8--faf86375-999e-422e-bab2-3dd58d26e71f.lovable.app-1784588583971.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/blogdel-48x48.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/blogdel-180x180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><HeadContent /><script dangerouslySetInnerHTML={{ __html: "(() => {\n  try {\n    const stored = localStorage.getItem(\"blogdel-theme\");\n    const mode = stored === \"light\" || stored === \"dark\" || stored === \"system\" ? stored : \"system\";\n    const dark = mode === \"dark\" || (mode === \"system\" && window.matchMedia(\"(prefers-color-scheme: dark)\").matches);\n    document.documentElement.classList.toggle(\"dark\", dark);\n    document.documentElement.dataset.theme = mode;\n  } catch {}\n})();" }} /></head><body>{children}<Scripts /></body></html>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => console.error("Blogdel service worker registration failed", error));
      if (document.readyState === "complete") register(); else window.addEventListener("load", register, { once: true });
    }
  }, []);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);
  return <QueryClientProvider client={queryClient}><Outlet /><Toaster richColors position="top-center" /></QueryClientProvider>;
}
