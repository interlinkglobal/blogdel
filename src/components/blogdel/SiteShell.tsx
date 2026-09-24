import { Link } from "@tanstack/react-router";
import { Download, Menu, Search } from "lucide-react";
import { toast } from "sonner";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { slug: "technology", label: "Technology" },
  { slug: "health", label: "Health" },
  { slug: "sports", label: "Sports" },
  { slug: "politics", label: "Politics" },
  { slug: "entertainment", label: "Entertainment" },
  { slug: "business", label: "Business" },
  { slug: "science", label: "Science" },
  { slug: "education", label: "Education" },
  { slug: "food", label: "Food" },
  { slug: "history", label: "History" },
];

export function SiteHeader() {
  const { canInstall, installed, install } = usePwaInstall();

  const handleInstall = async () => {
    const result = await install();
    if (result === "accepted") {
      toast.success("Blogdel installed.");
      return;
    }
    if (result === "dismissed") return;

    const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isAppleMobile) {
      toast("Install Blogdel from Safari", {
        description: "Tap Share, then Add to Home Screen.",
      });
    } else {
      toast("Installation is not available yet", {
        description: "Your browser may already have Blogdel installed or may not support app installation.",
      });
    }
  };

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between border-b border-border">
          <Link to="/" className="headline text-3xl md:text-4xl" aria-label="Blogdel home">
            Blogdel
          </Link>

          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center border border-border bg-card hover:border-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm">
              <SheetHeader>
                <SheetTitle className="headline text-3xl">Blogdel</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-4 text-base">
                <Link to="/blogs" className="border-b border-border pb-3">All articles</Link>
                <Link to="/about" className="border-b border-border pb-3">About</Link>
                <Link to="/disclosure" className="border-b border-border pb-3">AI disclosure</Link>
                <Link to="/readme" className="border-b border-border pb-3">Read me</Link>
              </nav>
              {!installed && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 border border-foreground bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-foreground"
                >
                  <Download className="h-4 w-4" />
                  {canInstall ? "Install Blogdel" : "Install app"}
                </button>
              )}
            </SheetContent>
          </Sheet>
        </div>

        <nav className="-mx-1 flex gap-2 overflow-x-auto border-b border-border px-1 py-3 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link to="/blogs" className="shrink-0 border border-border bg-card px-3 py-2 font-medium hover:border-foreground">
            All
          </Link>
          {NAV.map((n) => (
            <Link
              key={n.slug}
              to="/category/$slug"
              params={{ slug: n.slug }}
              className="shrink-0 border border-border bg-card px-3 py-2 text-muted-foreground hover:border-foreground hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <form action="/search" method="get" className="flex gap-2 py-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search Blogdel</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              placeholder="Search articles"
              className="h-10 w-full border border-border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
            />
          </label>
          <button
            type="submit"
            className="h-10 shrink-0 border border-foreground bg-foreground px-4 text-sm font-semibold text-background hover:bg-transparent hover:text-foreground"
          >
            Search
          </button>
        </form>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="headline text-2xl text-foreground">Blogdel</div>
            <p className="mt-2 max-w-md">
              Autonomous reporting and analysis from Interlink Media.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/disclosure" className="hover:text-foreground">AI disclosure</Link>
            <Link to="/blogs" className="hover:text-foreground">All articles</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-5 md:py-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
